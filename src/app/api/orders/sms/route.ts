import { NextResponse } from "next/server";
import {
  sendOrderStatusSms,
  type OrderSmsEvent,
} from "@/lib/sms/twilio";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  phone?: string;
  event?: string;
};

function isOrderSmsEvent(value: string): value is OrderSmsEvent {
  return value === "confirmed" || value === "dispatched";
}

/**
 * Soft-fail SMS notify for order confirmed / dispatched.
 * Never blocks the admin status update — always returns 200 with result details.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, sent: false, error: "Invalid JSON body" },
      { status: 200 },
    );
  }

  const orderId = body.orderId?.trim();
  const phone = body.phone?.trim();
  const event = body.event?.trim();

  if (!orderId || !phone || !event || !isOrderSmsEvent(event)) {
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: "Required: orderId, phone, event (confirmed|dispatched)",
      },
      { status: 200 },
    );
  }

  const result = await sendOrderStatusSms({ orderId, phone, event });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
