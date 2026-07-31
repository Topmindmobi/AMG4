import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push/send";
import { shortOrderRef } from "@/lib/sms/twilio";
import { formatKes } from "@/lib/format";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  orderId?: string;
  amountKes?: number;
};

/**
 * Push a "delivery payment sent" alert to a rider's device. Called by the
 * rider portal the moment they mark an order delivered — the in-app
 * notification (written synchronously by demo-store / mark_order_delivered)
 * is the guaranteed channel; this is the best-effort push on top of it.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 200 });
  }

  const { userId, orderId, amountKes } = body;
  if (!userId || !orderId || !amountKes) {
    return NextResponse.json(
      { ok: false, error: "Required: userId, orderId, amountKes" },
      { status: 200 },
    );
  }

  const result = await sendPushToUser(userId, {
    title: "Delivery payment sent",
    body: `Payment of ${formatKes(amountKes)} sent for order ${shortOrderRef(orderId)}.`,
    url: "/rider",
  });
  return NextResponse.json({ ok: true, ...result });
}
