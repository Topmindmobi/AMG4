import "server-only";

/**
 * Lightweight in-memory rate limiter for `/api/mpesa/stk-push`, which has to
 * stay callable pre-auth — at that point in checkout no order/account
 * necessarily exists yet (see that route's own comment for why). Same
 * in-memory-`Map` convention as `pending-store.ts` in this same directory.
 *
 * KNOWN LIMITATION, documented deliberately (this is a "lightweight"/P3 fix,
 * not a production-grade distributed rate limiter): this state lives only in
 * the current Node process's memory. It resets on every restart/deploy, and
 * does NOT coordinate across multiple server instances if this app is ever
 * horizontally scaled — each instance would enforce its own independent
 * limit, so the *effective* combined limit scales with instance count. Good
 * enough to blunt a single abusive client hammering this endpoint (fat-finger
 * loops, a script kiddie testing amounts); not a defense against a
 * distributed attacker. A real fix would back this with Redis/Postgres, same
 * caveat `pending-store.ts` already documents for its own in-memory state.
 */

type Bucket = { count: number; windowStartMs: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweepMs = 0;

/** Drop buckets whose window has long since expired, so this Map doesn't grow unbounded over the process's lifetime. */
function sweep(nowMs: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    if (nowMs - bucket.windowStartMs > windowMs) buckets.delete(key);
  }
}

/**
 * Records one request against `key` and returns whether it's still within
 * `limit` requests per rolling `windowMs`. Call once per incoming request
 * with every key that should independently gate it (e.g. once for the
 * phone number, once for the IP) — a request should be rejected if ANY key
 * is over its limit.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();
  if (now - lastSweepMs > SWEEP_INTERVAL_MS) {
    sweep(now, windowMs);
    lastSweepMs = now;
  }

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStartMs > windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
}

/** Best-effort client IP from standard proxy headers; falls back to a constant so at least the phone-number key still applies rate limiting when it's unavailable. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
