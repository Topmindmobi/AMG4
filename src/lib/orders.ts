import type { Order, OrderItem, SupplierOrderGroup, SupplyRequest } from "@/lib/types";

export function groupOrderBySupplier(
  order: Order,
  supplyRequests: SupplyRequest[] = [],
): SupplierOrderGroup[] {
  const items = order.items ?? [];
  const map = new Map<string, SupplierOrderGroup>();

  for (const item of items) {
    const key = item.supplier_id || "unassigned";
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.total_kes += item.price_kes * item.qty;
    } else {
      map.set(key, {
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name_snapshot || "Unassigned (AMG stock)",
        items: [item],
        total_kes: item.price_kes * item.qty,
        supply_request: null,
      });
    }
  }

  for (const group of map.values()) {
    if (!group.supplier_id) continue;
    group.supply_request =
      supplyRequests.find(
        (r) => r.order_id === order.id && r.supplier_id === group.supplier_id,
      ) ?? null;
  }

  return Array.from(map.values());
}

export function allSuppliersConfirmed(
  groups: SupplierOrderGroup[],
): boolean {
  const assigned = groups.filter((g) => g.supplier_id);
  if (assigned.length === 0) return true;
  return assigned.every((g) => g.supply_request?.status === "confirmed");
}

export function enrichOrderItemsWithSuppliers(
  items: Omit<OrderItem, "supplier_id" | "supplier_name_snapshot">[],
  products: { id: string; supplier_id: string | null }[],
  suppliers: { id: string; name: string }[],
): OrderItem[] {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    const supplier = suppliers.find((s) => s.id === product?.supplier_id);
    return {
      ...item,
      supplier_id: product?.supplier_id ?? null,
      supplier_name_snapshot: supplier?.name ?? null,
    };
  });
}
