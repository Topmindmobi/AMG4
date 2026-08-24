import { NextResponse } from "next/server";
import { resolvePending } from "@/lib/mpesa/pending-store";

export const runtime = "nodejs";

type DarajaCallback = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
    };
  };
};

/**
 * Safaricom calls this URL (MPESA_CALLBACK_URL) once the buyer confirms or
 * cancels the STK push on their phone. Not reachable from a sandboxed dev
 * environment without a public HTTPS tunnel — wire MPESA_CALLBACK_URL to a
 * real deployment before relying on the live (non-simulated) payment path.
 */
export async function POST(request: Request) {
  let body: DarajaCallback;
  try {
    body = (await request.json()) as DarajaCallback;
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const callback = body.Body?.stkCallback;
  if (callback) {
    if (callback.ResultCode === 0) {
      const receipt = callback.CallbackMetadata?.Item?.find(
        (i) => i.Name === "MpesaReceiptNumber",
      )?.Value;
      resolvePending(callback.CheckoutRequestID, {
        status: "paid",
        mpesaReceipt: receipt ? String(receipt) : undefined,
      });
      console.info(`[mpesa] payment confirmed ${callback.CheckoutRequestID} receipt=${receipt}`);
    } else {
      resolvePending(callback.CheckoutRequestID, {
        status: "failed",
        reason: callback.ResultDesc,
      });
      console.warn(`[mpesa] payment failed ${callback.CheckoutRequestID}: ${callback.ResultDesc}`);
    }
  }

  // Safaricom expects this exact acknowledgement shape regardless of outcome,
  // otherwise it retries the callback.
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
