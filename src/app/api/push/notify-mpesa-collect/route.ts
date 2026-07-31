import { NextResponse } from "next/server";
import { formatKes } from "@/lib/format";
import { sendPushToUser } from "@/lib/push/send";
import { shortOrderRef } from "@/lib/sms/twilio";

export const runtime = "nodejs";

type Body = {
  /** Rider user id — reminder to wait for confirmation */
  riderUserId?: string;
  /** Customer user id when logged-in */
  customerUserId?: string | null;
  orderId?: string;
  amountKes?: number;
  phone?: string;
};

/**
 * Push when rider triggers door-side M-Pesa STK:
 * remind rider to wait for payment; alert customer if subscribed.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 200 });
  }

  const { riderUserId, customerUserId, orderId, amountKes, phone } = body;
  if (!orderId || !amountKes) {
    return NextResponse.json(
      { ok: false, error: "Required: orderId, amountKes" },
      { status: 200 },
    );
  }

  const results: Record<string, unknown> = {};

  if (riderUserId) {
    results.rider = await sendPushToUser(riderUserId, {
      title: "M-Pesa prompt sent — wait for payment",
      body: `STK push for ${formatKes(amountKes)} on order ${shortOrderRef(orderId)}${
        phone ? ` → ${phone}` : ""
      }. Do not leave until payment is registered.`,
      url: "/rider",
    });
  }

  if (customerUserId) {
    results.customer = await sendPushToUser(customerUserId, {
      title: "Confirm M-Pesa payment",
      body: `Enter your M-Pesa PIN for ${formatKes(amountKes)} (order ${shortOrderRef(orderId)}). The rider will wait until payment is confirmed.`,
      url: `/order/${orderId}`,
    });
  }

  return NextResponse.json({ ok: true, ...results });
}
