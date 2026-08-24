"use client";

// Offline-first order submission: tries the live place_order() RPC first; if
// the device is offline or the request fails at the network level (not a
// validation/RLS error — those still surface to the user immediately), the
// order is queued in IndexedDB and retried automatically once connectivity
// returns (on the `online` event, on app foreground, and via a best-effort
// Background Sync registration for when the tab isn't in focus).
//
// Pricing/stock/atomicity are all enforced server-side inside place_order()
// (supabase/migrations/019_place_order_rpc.sql) — this module no longer
// inserts into orders/order_items directly (those tables' INSERT policies
// were tightened in the same migration to block that entirely). See
// PlaceOrderInput below for exactly what's still decided client-side (who,
// what, where — never price).

import { idbDelete, idbGetAll, idbPut, ORDERS_STORE } from "./db";

/** Everything place_order() needs. Prices/totals are NOT here — the RPC
 *  looks those up itself from `products`, ignoring anything the client
 *  might claim. `id` is a client-generated idempotency key: if the same id
 *  is submitted twice (e.g. a retried offline-queue entry after a lost
 *  response), place_order() returns the already-created row instead of
 *  erroring or duplicating it. */
export type PlaceOrderInput = {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  town: string;
  address: string;
  payment_method: string;
  mpesa_phone: string | null;
  delivery_method: string;
  dropoff_point_id: string | null;
  dropoff_point_name: string | null;
  items: { productId: string; qty: number }[];
};

export type PlacedOrderRow = Record<string, unknown>;

export type SubmitOrderResult =
  | { queued: false; orderId: string; order: PlacedOrderRow }
  | { queued: true; orderId: string };

type QueuedOrder = {
  localId: string;
  orderId: string;
  createdAt: string;
  input: PlaceOrderInput;
  accessToken: string | null;
};

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

async function callPlaceOrder(input: PlaceOrderInput): Promise<PlacedOrderRow> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_order_id: input.id,
    p_customer_name: input.customer_name,
    p_phone: input.phone,
    p_email: input.email,
    p_town: input.town,
    p_address: input.address,
    p_payment_method: input.payment_method,
    p_mpesa_phone: input.mpesa_phone,
    p_delivery_method: input.delivery_method,
    p_dropoff_point_id: input.dropoff_point_id,
    p_dropoff_point_name: input.dropoff_point_name,
    p_user_id: input.user_id,
    p_items: input.items,
  });
  if (error) throw error;
  return data as PlacedOrderRow;
}

/**
 * Attempts the real place_order() RPC call. On a network-level failure,
 * queues it for later sync instead of surfacing an error to the shopper.
 * Validation/RLS/business-rule errors (bad price lookup, insufficient stock,
 * etc.) are NOT queued — they're thrown so the checkout form can show the
 * real problem.
 */
export async function submitOrder(input: PlaceOrderInput): Promise<SubmitOrderResult> {
  if (!navigator.onLine) {
    await queueOrder(input);
    return { queued: true, orderId: input.id };
  }

  try {
    const order = await callPlaceOrder(input);
    return { queued: false, orderId: input.id, order };
  } catch (err) {
    if (isNetworkError(err)) {
      await queueOrder(input);
      return { queued: true, orderId: input.id };
    }
    throw err;
  }
}

async function queueOrder(input: PlaceOrderInput): Promise<void> {
  const entry: QueuedOrder = {
    localId: input.id,
    orderId: input.id,
    createdAt: new Date().toISOString(),
    input,
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

  const queued = await listQueuedOrders();
  let synced = 0;

  for (const entry of queued) {
    try {
      // place_order() is idempotent on p_order_id (entry.input.id), so a
      // replay of an already-committed submission just returns the existing
      // row instead of erroring or duplicating it — no special "already
      // exists" error-code handling needed here anymore.
      await callPlaceOrder(entry.input);
      await idbDelete(ORDERS_STORE, entry.localId);
      synced += 1;
    } catch (err) {
      if (!isNetworkError(err)) {
        // Not retryable (e.g. schema drift, stock now insufficient) — drop it
        // rather than retry forever.
        await idbDelete(ORDERS_STORE, entry.localId);
      }
      // Network errors: leave queued, try again next time.
    }
  }

  const remaining = (await listQueuedOrders()).length;
  return { synced, remaining };
}
