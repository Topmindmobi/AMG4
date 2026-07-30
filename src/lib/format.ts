export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  awaiting_supplier: "Awaiting supplier",
  supplier_confirmed: "Supplier confirmed",
  confirmed: "Confirmed (buyer notified)",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting supplier",
  confirmed: "Supplier confirmed",
  rejected: "Supplier rejected",
};

export const TOWNS = ["Homabay", "Mbita", "Migori"] as const;
