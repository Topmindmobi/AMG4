import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { consumePendingPaid } from "@/lib/mpesa/pending-store";
import { PAY_NOW_DISCOUNT_RATE } from "@/lib/format";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  checkoutRequestId?: string;
};

/**
 * The only place besides the (future) authenticated Daraja callback flow
 * that can move orders.paid to true. Never trusts a client-asserted "paid"
 * boolean — the caller only supplies an orderId and the opaque
 * checkoutRequestId token it received from /api/mpesa/stk-push. That token
 * can only resolve to "paid" via a real Daraja webhook confirmation (see
 * /api/mpesa/callback) or, when Daraja isn't configured for this deployment,
 * the equivalent simulated-instant-confirmation branch of stk-push — never
 * by anything the browser itself asserts. See src/lib/mpesa/pending-store.ts.
 *
 * Why this route exists instead of the callback route setting orders.paid
 * directly: in this app's checkout flow, the M-Pesa "pay now" step
 * (stk-push) happens BEFORE the order is created — the buyer pays first,
 * then submits the rest of the checkout form, which is when
 * place_order() actually inserts the order (see
 * supabase/migrations/019_place_order_rpc.sql, which always inserts
 * paid = false). So there is no order row for the Daraja callback to update
 * at the moment payment is confirmed. This route is called from
 * src/app/checkout/page.tsx immediately after place_order() returns a real
 * order id, closing that gap: it re-validates the payment token server-side
 * and only then flips paid=true on that specific order, using the
 * service-role admin client (bypasses RLS by design — this is the trusted
 * server-side write path, never exposed to the browser as a Postgres RPC a
 * client could call directly with arbitrary arguments).
 *
 * Soft-fails on purpose (mirrors orders/sms and orders/email): if this call
 * never arrives, or the token is invalid/expired/already used, the order
 * simply stays unpaid for admin reconciliation — it never blocks checkout
 * from completing, and it can never be used to mark a *different* order paid
 * than the one actually paid for (the amount check below ties the two
 * together).
 */
export async function POST(request: Request) {
  if (!isAdminClientConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Payment confirmation is not configured" },
      { status: 501 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = body.orderId?.trim();
  const checkoutRequestId = body.checkoutRequestId?.trim();
  if (!orderId || !checkoutRequestId) {
    return NextResponse.json(
      { ok: false, error: "Required: orderId, checkoutRequestId" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, paid, payment_method, subtotal_kes, total_kes")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  if (order.paid) {
    // Idempotent: a retry after a lost response shouldn't error.
    return NextResponse.json({ ok: true, already: true });
  }
  if (order.payment_method !== "mpesa") {
    return NextResponse.json({ ok: false, error: "Order is not an M-Pesa order" }, { status: 400 });
  }

  const paidResult = consumePendingPaid(checkoutRequestId);
  if (!paidResult) {
    return NextResponse.json(
      { ok: false, error: "No confirmed M-Pesa payment found for this token" },
      { status: 400 },
    );
  }

  // Pre-existing (unchanged) business rule: the STK push charges the buyer
  // the full pre-discount subtotal, and total_kes reflects the pay-now
  // discount netted off afterwards — so the amount actually paid via M-Pesa
  // should always cover at least the order's subtotal. +1 covers integer-KES
  // STK rounding vs numeric(12,2) totals.
  const subtotal = Number(order.subtotal_kes ?? order.total_kes ?? 0);
  if (paidResult.amountKes + 1 < subtotal) {
    return NextResponse.json(
      { ok: false, error: "Paid amount does not cover this order's total" },
      { status: 400 },
    );
  }

  const discountKes = Math.round(subtotal * PAY_NOW_DISCOUNT_RATE);
  const totalKes = subtotal - discountKes;

  const paidAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("orders")
    .update({
      paid: true,
      paid_at: paidAt,
      discount_kes: discountKes,
      total_kes: totalKes,
    })
    .eq("id", orderId)
    .eq("paid", false);

  if (updateError) {
    console.error("[mpesa/confirm-order-payment]", updateError);
    return NextResponse.json({ ok: false, error: "Could not confirm payment" }, { status: 500 });
  }

  // Returned so the checkout page can update its already-stashed
  // sessionStorage confirmation snapshot in place — guest buyers aren't
  // signed into the account silently created for them, so the confirmation
  // page's live re-fetch via get_order_confirmation (which requires
  // auth.uid() to match, see 018_lock_order_confirmation.sql) won't reflect
  // this update for them; without this, a guest who paid via M-Pesa would
  // keep seeing "not paid" on their own confirmation page.
  return NextResponse.json({ ok: true, paid: true, paid_at: paidAt, discount_kes: discountKes, total_kes: totalKes });
}
