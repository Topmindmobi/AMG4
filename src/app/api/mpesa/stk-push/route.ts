import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { initiateStkPush, isDarajaConfigured } from "@/lib/mpesa/daraja";
import { registerPending, resolvePending } from "@/lib/mpesa/pending-store";
import { checkRateLimit, getClientIp } from "@/lib/mpesa/rate-limit";

export const runtime = "nodejs";

/** Max STK push attempts allowed per rolling 60s window, per key. Deliberately generous
 * for a genuine shopper retrying a failed prompt a couple of times, tight enough to blunt
 * a script hammering this pre-auth endpoint. See rate-limit.ts for the in-memory caveat. */
const MAX_PER_PHONE_PER_MINUTE = 5;
const MAX_PER_IP_PER_MINUTE = 10;

type Body = {
  phone?: string;
  amountKes?: number;
  accountRef?: string;
};

/**
 * Pay-now checkout step. Real Daraja STK push when configured (resolves
 * asynchronously via /api/mpesa/callback — poll /api/mpesa/status);
 * otherwise an instant simulated confirmation so checkout always works.
 *
 * amountKes is still only sanity-checked (> 0) here — at this point in the
 * flow no order exists yet (the order is only created later, at final
 * checkout submit, via place_order()), so there is no server-computed order
 * total to validate against yet. The real financial control is downstream:
 * every checkoutRequestId returned from this route is registered in
 * pending-store with the amount actually sent to Daraja (or, for the
 * simulated path, the amount the caller asked to simulate), and
 * /api/mpesa/confirm-order-payment cross-checks that registered amount
 * against the REAL order total (looked up server-side from the orders row
 * place_order() just created) before it will ever mark an order paid. A
 * client can still ask to simulate paying a low amount, but it can no
 * longer parlay that into a `paid: true` order for a higher total.
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

  const ip = getClientIp(request);
  const withinPhoneLimit = checkRateLimit(`phone:${phone}`, MAX_PER_PHONE_PER_MINUTE);
  const withinIpLimit = checkRateLimit(`ip:${ip}`, MAX_PER_IP_PER_MINUTE);
  if (!withinPhoneLimit || !withinIpLimit) {
    return NextResponse.json(
      { ok: false, error: "Too many payment attempts — please wait a minute and try again." },
      { status: 429 },
    );
  }

  if (!isDarajaConfigured()) {
    // Simulated instant confirmation — mirrors what a real STK push resolves to,
    // without requiring live Daraja credentials or a public callback URL.
    await new Promise((r) => setTimeout(r, 1200));
    const checkoutRequestId = `simulated-${randomUUID()}`;
    registerPending(checkoutRequestId, amountKes);
    resolvePending(checkoutRequestId, { status: "paid" });
    return NextResponse.json({
      ok: true,
      status: "paid",
      simulated: true,
      checkoutRequestId,
      message: "Simulated M-Pesa confirmation (Daraja not configured for this environment).",
    });
  }

  const result = await initiateStkPush({
    phone,
    amountKes,
    accountRef: body.accountRef || "AMGCOM",
    // Daraja's TransactionDesc field has historically had a short length cap on
    // some accounts — kept brief ("AMG order") rather than the full "AMG Online
    // Store order" to stay safely under it.
    description: "AMG order",
  });

  if (!result.initiated) {
    return NextResponse.json({ ok: false, status: "failed", simulated: false, error: result.error });
  }

  registerPending(result.checkoutRequestId, amountKes);
  return NextResponse.json({
    ok: true,
    status: "pending",
    simulated: false,
    checkoutRequestId: result.checkoutRequestId,
  });
}
