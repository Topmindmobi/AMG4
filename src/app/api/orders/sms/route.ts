import { NextResponse } from "next/server";
import {
  sendOrderStatusSms,
  type OrderSmsEvent,
} from "@/lib/sms/twilio";
import { requireSession } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  phone?: string;
  event?: string;
};

function isOrderSmsEvent(value: string): value is OrderSmsEvent {
  return (
    value === "placed" ||
    value === "confirmed" ||
    value === "dispatched" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

/**
 * Soft-fail SMS notify for order placed / confirmed / dispatched / delivered / cancelled.
 * Never blocks the admin status update — always returns 200 with result details,
 * EXCEPT for auth failures, which return a real 401/403 so this endpoint can't be
 * used to spam arbitrary numbers on AMG's paid Twilio account. The one real caller
 * today (src/lib/notifications/notify-client.ts, used only from the admin order
 * pages) already treats any non-ok HTTP status as a soft failure, so this doesn't
 * change its behavior for legitimate admin use.
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
        error: "Required: orderId, phone, event (placed|confirmed|dispatched|delivered|cancelled)",
      },
      { status: 200 },
    );
  }

  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, sent: false, error: "Not signed in" },
      { status: 401 },
    );
  }
  const { data: orderRow } = await session.server
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) {
    return NextResponse.json(
      { ok: false, sent: false, error: "Not authorized for this order" },
      { status: 403 },
    );
  }

  const result = await sendOrderStatusSms({ orderId, phone, event });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
