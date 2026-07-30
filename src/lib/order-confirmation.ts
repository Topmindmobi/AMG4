import type { Order, OrderItem, PaymentMethod, Town } from "@/lib/types";

const KEY_PREFIX = "amg_order_confirm_";

export type PlacedOrderSnapshot = {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  town: Town;
  address: string;
  payment_method: PaymentMethod;
  mpesa_phone: string | null;
  status: "pending";
  total_kes: number;
  created_at: string;
  items: Array<{
    id: string;
    order_id: string;
    product_id: string | null;
    name_snapshot: string;
    price_kes: number;
    qty: number;
    supplier_id: string | null;
    supplier_name_snapshot: string | null;
  }>;
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
    const parsed = JSON.parse(raw) as PlacedOrderSnapshot;
    return {
      ...parsed,
      items: parsed.items as OrderItem[],
    };
  } catch {
    return null;
  }
}
