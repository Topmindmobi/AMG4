"use client";

// Offline-first order submission: tries the live Supabase insert first; if the
// device is offline or the request fails at the network level (not a
// validation/RLS error — those still surface to the user immediately), the
// order is queued in IndexedDB and retried automatically once connectivity
// returns (on the `online` event, on app foreground, and via a best-effort
// Background Sync registration for when the tab isn't in focus).

import { idbDelete, idbGetAll, idbPut, ORDERS_STORE } from "./db";

export type QueuedOrder = {
  localId: string;
  orderId: string;
  createdAt: string;
  orderRow: Record<string, unknown>;
  lineItems: Record<string, unknown>[];
  accessToken: string | null;
};

export type SubmitOrderResult =
  | { queued: false; orderId: string }
  | { queued: true; orderId: string };

function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /fetch|network|failed to fetch|load failed/i.test(message);
}

async function currentAccessToken(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Attempts the real order + order_items insert. On a network-level failure,
 * queues it for later sync instead of surfacing an error to the shopper.
 * Validation/RLS errors are NOT queued — they're thrown so the checkout form
 * can show the real problem.
 */
export async function submitOrder(
  orderRow: Record<string, unknown>,
  lineItems: Record<string, unknown>[],
): Promise<SubmitOrderResult> {
  const orderId = orderRow.id as string;

  if (!navigator.onLine) {
    await queueOrder(orderId, orderRow, lineItems);
    return { queued: true, orderId };
  }

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    const { error: orderError } = await supabase.from("orders").insert(orderRow);
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(lineItems);
    if (itemsError) throw itemsError;

    return { queued: false, orderId };
  } catch (err) {
    if (isNetworkError(err)) {
      await queueOrder(orderId, orderRow, lineItems);
      return { queued: true, orderId };
    }
    throw err;
  }
}

async function queueOrder(
  orderId: string,
  orderRow: Record<string, unknown>,
  lineItems: Record<string, unknown>[],
): Promise<void> {
  const entry: QueuedOrder = {
    localId: orderId,
    orderId,
    createdAt: new Date().toISOString(),
    orderRow,
    lineItems,
    accessToken: await currentAccessToken(),
  };
  await idbPut(ORDERS_STORE, entry);
  await registerBackgroundSync();
}

async function registerBackgroundSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    // Background Sync isn't in the TS lib.dom types yet; feature-detect at runtime.
    const syncReg = reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    await syncReg.sync?.register("sync-orders");
  } catch {
    // Unsupported (e.g. Safari) — the `online` event listener below still covers it.
  }
}

export async function listQueuedOrders(): Promise<QueuedOrder[]> {
  try {
    return await idbGetAll<QueuedOrder>(ORDERS_STORE);
  } catch {
    return [];
  }
}

/** Retries every queued order. Safe to call repeatedly (e.g. on every reconnect). */
export async function flushQueuedOrders(): Promise<{ synced: number; remaining: number }> {
  if (!navigator.onLine) return { synced: 0, remaining: (await listQueuedOrders()).length };

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const queued = await listQueuedOrders();
  let synced = 0;

  for (const entry of queued) {
    try {
      const { error: orderError } = await supabase.from("orders").insert(entry.orderRow);
      if (orderError && orderError.code !== "23505") throw orderError; // 23505 = already exists, treat as success
      const { error: itemsError } = await supabase.from("order_items").insert(entry.lineItems);
      if (itemsError && itemsError.code !== "23505") throw itemsError;

      await idbDelete(ORDERS_STORE, entry.localId);
      synced += 1;
    } catch (err) {
      if (!isNetworkError(err)) {
        // Not retryable (e.g. schema drift) — drop it rather than retry forever.
        await idbDelete(ORDERS_STORE, entry.localId);
      }
      // Network errors: leave queued, try again next time.
    }
  }

  const remaining = (await listQueuedOrders()).length;
  return { synced, remaining };
}
