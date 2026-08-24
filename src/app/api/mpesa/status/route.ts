import { NextResponse } from "next/server";
import { getPending } from "@/lib/mpesa/pending-store";

export const runtime = "nodejs";

/** Poll the outcome of a real (non-simulated) STK push while awaiting the Daraja callback. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("checkoutRequestId");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing checkoutRequestId" }, { status: 400 });
  }
  const result = getPending(id);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Unknown checkoutRequestId" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...result });
}
