import "server-only";

/**
 * Tracks real (non-simulated) STK push requests between initiation and the
 * Daraja callback. In-memory is fine here: a single Node process for the
 * lifetime of a checkout attempt (seconds). A real multi-instance deployment
 * would back this with Redis/Postgres instead.
 *
 * Also doubles as the anti-forgery source of truth for "was this checkout
 * actually paid": stk-push/route.ts registers the amount it charged (real or
 * simulated) against the checkoutRequestId; confirm-order-payment/route.ts
 * later consumes that record (once) to authorize marking a specific order
 * paid. Nothing about "paid" is ever accepted as a bare client assertion.
 */
type PendingResult =
  | { status: "pending"; amountKes: number }
  | { status: "paid"; amountKes: number; mpesaReceipt?: string; consumed?: boolean }
  | { status: "failed"; amountKes: number; reason: string };

const store = new Map<string, PendingResult>();

export function registerPending(checkoutRequestId: string, amountKes: number) {
  store.set(checkoutRequestId, { status: "pending", amountKes });
}

export function resolvePending(
  checkoutRequestId: string,
  result: { status: "paid"; mpesaReceipt?: string } | { status: "failed"; reason: string },
) {
  const existing = store.get(checkoutRequestId);
  const amountKes = existing?.amountKes ?? 0;
  store.set(checkoutRequestId, { ...result, amountKes } as PendingResult);
}

export function getPending(checkoutRequestId: string): PendingResult | undefined {
  return store.get(checkoutRequestId);
}

/**
 * One-time consumption of a genuinely "paid" result. Returns null if the
 * token is unknown, was never resolved paid, or was already consumed by an
 * earlier call (replay protection — one checkoutRequestId can confirm at
 * most one order). On success, marks it consumed so it can't be reused.
 */
export function consumePendingPaid(
  checkoutRequestId: string,
): { amountKes: number; mpesaReceipt?: string } | null {
  const existing = store.get(checkoutRequestId);
  if (!existing || existing.status !== "paid" || existing.consumed) return null;
  store.set(checkoutRequestId, { ...existing, consumed: true });
  return { amountKes: existing.amountKes, mpesaReceipt: existing.mpesaReceipt };
}
