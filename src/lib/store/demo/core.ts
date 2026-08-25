"use client";

/**
 * Shared localStorage-backed storage primitives for every demo-mode domain
 * module under `src/lib/store/demo/*`. Extracted from the original
 * `demo-store.ts` "god file" (see that file's own comment) as part of
 * splitting it into per-domain modules — this piece stays internal (never
 * re-exported through the `demo-store.ts` barrel) since none of `KEYS`,
 * `read`, `write`, `ensureSeeded`, or `shortId` were ever part of the
 * module's public surface before the split either.
 */

import {
  DEMO_ADMIN,
  DEMO_CATEGORIES,
  DEMO_CUSTOMER,
  DEMO_DROPOFF_POINTS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_RIDER_USERS,
  DEMO_RIDERS,
  DEMO_SUPPLIER_ADDRESSES,
  DEMO_SUPPLIER_USERS,
  DEMO_SUPPLIERS,
} from "@/lib/demo-data";

export const KEYS = {
  products: "amg_products_v5",
  categories: "amg_categories",
  suppliers: "amg_suppliers_v2",
  orders: "amg_orders_v7",
  session: "amg_session",
  profiles: "amg_profiles_v6",
  /** email → password for demo-created customer accounts */
  credentials: "amg_credentials_v1",
  supplyRequests: "amg_supply_requests_v1",
  notifications: "amg_notifications_v1",
  riders: "amg_riders_v1",
  dropoffPoints: "amg_dropoff_points_v1",
  riderPayouts: "amg_rider_payouts_v1",
  quoteRequests: "amg_quote_requests_v1",
  callbackRequests: "amg_callback_requests_v1",
  supplierAddresses: "amg_supplier_addresses_v1",
  serviceRatings: "amg_service_ratings_v1",
};

export function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(KEYS.products)) write(KEYS.products, DEMO_PRODUCTS);
  if (!localStorage.getItem(KEYS.categories)) write(KEYS.categories, DEMO_CATEGORIES);
  if (!localStorage.getItem(KEYS.suppliers)) write(KEYS.suppliers, DEMO_SUPPLIERS);
  if (!localStorage.getItem(KEYS.supplierAddresses)) {
    write(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  }
  if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, DEMO_ORDERS);
  if (!localStorage.getItem(KEYS.supplyRequests)) write(KEYS.supplyRequests, []);
  if (!localStorage.getItem(KEYS.notifications)) write(KEYS.notifications, []);
  if (!localStorage.getItem(KEYS.riders)) write(KEYS.riders, DEMO_RIDERS);
  if (!localStorage.getItem(KEYS.dropoffPoints)) write(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  if (!localStorage.getItem(KEYS.riderPayouts)) write(KEYS.riderPayouts, []);
  if (!localStorage.getItem(KEYS.quoteRequests)) write(KEYS.quoteRequests, []);
  if (!localStorage.getItem(KEYS.callbackRequests)) write(KEYS.callbackRequests, []);
  if (!localStorage.getItem(KEYS.serviceRatings)) write(KEYS.serviceRatings, []);
  if (!localStorage.getItem(KEYS.profiles)) {
    write(KEYS.profiles, [
      DEMO_CUSTOMER,
      DEMO_ADMIN,
      ...DEMO_SUPPLIER_USERS,
      ...DEMO_RIDER_USERS,
    ]);
  }
  if (!localStorage.getItem(KEYS.credentials)) {
    write(KEYS.credentials, {
      "customer@amg.com": "customer123",
      "admin@amg.com": "admin123",
      "lakeview@amg.com": "supplier123",
      "ruma@amg.com": "supplier123",
      "migori@amg.com": "supplier123",
      "brian@amg.com": "rider123",
      "faith@amg.com": "rider123",
      "kevin@amg.com": "rider123",
    } satisfies Record<string, string>);
  }
}

/** Short human-friendly id used in notification copy (order refs, payout refs, …). */
export function shortId(id: string): string {
  return id.startsWith("ord-") ? id.slice(0, 12) : id.slice(0, 8).toUpperCase();
}
