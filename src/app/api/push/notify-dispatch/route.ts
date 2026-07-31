import { NextResponse } from "next/server";
import { formatKes } from "@/lib/format";
import { sendPushToUser } from "@/lib/push/send";
import { shortOrderRef } from "@/lib/sms/twilio";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  orderId?: string;
  town?: string;
  totalKes?: number;
  customerName?: string;
};

/** Push to rider when admin dispatches an order to them. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 200 });
  }

  const { userId, orderId, town, totalKes, customerName } = body;
  if (!userId || !orderId) {
    return NextResponse.json(
      { ok: false, error: "Required: userId, orderId" },
      { status: 200 },
    );
  }

  const where = town ? ` to ${town}` : "";
  const who = customerName ? ` for ${customerName}` : "";
  const amount =
    typeof totalKes === "number" ? ` · ${formatKes(totalKes)}` : "";

  const result = await sendPushToUser(userId, {
    title: "New delivery assigned",
    body: `Order ${shortOrderRef(orderId)}${who}${where}${amount}. Keep it under your care until paid.`,
    url: "/rider",
  });
  return NextResponse.json({ ok: true, ...result });
}
