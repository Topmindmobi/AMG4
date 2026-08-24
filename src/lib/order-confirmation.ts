import type { Order, OrderItem } from "@/lib/types";

const KEY_PREFIX = "amg_order_confirm_";
const ACCOUNT_KEY_PREFIX = "amg_order_account_";

/** Freshly-placed order, always carrying its line items (unlike Order.items, which is optional). */
export type PlacedOrderSnapshot = Omit<Order, "items"> & { items: OrderItem[] };

/** One-time notice after guest checkout auto-created (or linked) an account. */
export type AccountCreatedNotice = {
  email: string;
  phone?: string | null;
  created: boolean;
  temporaryPassword?: string;
};

export function stashOrderConfirmation(order: PlacedOrderSnapshot) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${order.id}`, JSON.stringify(order));
  } catch {
    // Ignore quota / private mode failures — confirmation page may fall back to DB.
  }
}

export function readStashedOrderConfirmation(id: string): Order | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as PlacedOrderSnapshot;
  } catch {
    return null;
  }
}

export function stashAccountCreatedNotice(orderId: string, notice: AccountCreatedNotice) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ACCOUNT_KEY_PREFIX}${orderId}`, JSON.stringify(notice));
  } catch {
    // ignore
  }
}

export function readAccountCreatedNotice(orderId: string): AccountCreatedNotice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${ACCOUNT_KEY_PREFIX}${orderId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AccountCreatedNotice;
  } catch {
    return null;
  }
}
