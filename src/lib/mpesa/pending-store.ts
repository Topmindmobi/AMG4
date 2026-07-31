import "server-only";

/**
 * Tracks real (non-simulated) STK push requests between initiation and the
 * Daraja callback. In-memory is fine here: a single Node process for the
 * lifetime of a checkout attempt (seconds). A real multi-instance deployment
 * would back this with Redis/Postgres instead.
 */
type PendingResult =
  | { status: "pending" }
  | { status: "paid"; mpesaReceipt?: string }
  | { status: "failed"; reason: string };

const store = new Map<string, PendingResult>();

export function registerPending(checkoutRequestId: string) {
  store.set(checkoutRequestId, { status: "pending" });
}

export function resolvePending(checkoutRequestId: string, result: PendingResult) {
  store.set(checkoutRequestId, result);
}

export function getPending(checkoutRequestId: string): PendingResult | undefined {
  return store.get(checkoutRequestId);
}
