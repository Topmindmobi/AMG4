import { NextResponse } from "next/server";
import { sendOrderStatusEmail } from "@/lib/email/resend";
import type { OrderSmsEvent } from "@/lib/sms/twilio";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  email?: string;
  event?: string;
};

function isOrderEvent(value: string): value is OrderSmsEvent {
  return value === "confirmed" || value === "dispatched" || value === "delivered";
}

/**
 * Soft-fail email notify for order confirmed / dispatched / delivered.
 * Never blocks the caller — always returns 200 with result details.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, sent: false, error: "Invalid JSON body" }, { status: 200 });
  }

  const orderId = body.orderId?.trim();
  const email = body.email?.trim();
  const event = body.event?.trim();

  if (!orderId || !email || !event || !isOrderEvent(event)) {
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: "Required: orderId, email, event (confirmed|dispatched|delivered)",
      },
      { status: 200 },
    );
  }

  const result = await sendOrderStatusEmail({ to: email, orderId, event });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
