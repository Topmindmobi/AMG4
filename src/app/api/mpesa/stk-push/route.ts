import { NextResponse } from "next/server";
import { initiateStkPush, isDarajaConfigured } from "@/lib/mpesa/daraja";
import { registerPending } from "@/lib/mpesa/pending-store";

export const runtime = "nodejs";

type Body = {
  phone?: string;
  amountKes?: number;
  accountRef?: string;
};

/**
 * Pay-now checkout step. Real Daraja STK push when configured (resolves
 * asynchronously via /api/mpesa/callback — poll /api/mpesa/status);
 * otherwise an instant simulated confirmation so checkout always works.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const phone = body.phone?.trim();
  const amountKes = body.amountKes;
  if (!phone || !amountKes || amountKes <= 0) {
    return NextResponse.json(
      { ok: false, error: "Required: phone, amountKes (> 0)" },
      { status: 400 },
    );
  }

  if (!isDarajaConfigured()) {
    // Simulated instant confirmation — mirrors what a real STK push resolves to,
    // without requiring live Daraja credentials or a public callback URL.
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({
      ok: true,
      status: "paid",
      simulated: true,
      message: "Simulated M-Pesa confirmation (Daraja not configured for this environment).",
    });
  }

  const result = await initiateStkPush({
    phone,
    amountKes,
    accountRef: body.accountRef || "AMGCOM",
    description: "AMG Stores order",
  });

  if (!result.initiated) {
    return NextResponse.json({ ok: false, status: "failed", simulated: false, error: result.error });
  }

  registerPending(result.checkoutRequestId);
  return NextResponse.json({
    ok: true,
    status: "pending",
    simulated: false,
    checkoutRequestId: result.checkoutRequestId,
  });
}
