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

export const RIDER_DELIVERY_COLUMNS = [
  { id: "assigned", title: "My deliveries", hint: "Newly assigned by AMG" },
  { id: "collected", title: "Collected for delivery", hint: "Picked up from AMG hub" },
  { id: "in_transit", title: "In Transit", hint: "On the way to the client" },
  { id: "delivered", title: "Delivered", hint: "Goods handed over" },
  { id: "paid", title: "Paid", hint: "Payment registered — trip closed" },
  { id: "failed", title: "Fail Delivery", hint: "Could not complete delivery" },
] as const;

export const RIDER_DELIVERY_STATUS_LABELS: Record<string, string> = {
  assigned: "Rider assigned",
  collected: "Collected for delivery",
  in_transit: "In transit",
  delivered: "Delivered",
  paid: "Paid",
  failed: "Fail delivery",
};

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  pending: "New order",
  confirmed: "Confirmed",
  dispatched: "Dispatched to AMG",
  fulfilled: "Fulfilled (AMG certified)",
  rejected: "Rejected",
};

export const SUPPLY_METHOD_LABELS: Record<string, string> = {
  boda: "Motorcycle (boda)",
  van: "Van / pickup",
  self_dropoff: "Self drop-off at hub",
  courier: "Courier / other",
};

export const SUPPLY_VEHICLE_LABELS: Record<string, string> = {
  boda: "Motorcycle (boda / rider)",
  van: "Van / pickup",
  truck: "Truck",
};

/** Supplier has agreed (and may already be shipping). */
export function supplyRequestAgreed(status: string): boolean {
  return status === "confirmed" || status === "dispatched" || status === "fulfilled";
}

export const TOWNS = ["Homabay", "Mbita", "Migori"] as const;

/** Reward for paying online upfront via M-Pesa instead of cash on delivery. */
export const PAY_NOW_DISCOUNT_RATE = 0.05;

/** Flat commission a rider earns per completed delivery. */
export const RIDER_PAYOUT_KES = 150;

/** Flat delivery estimate added to instant building-materials quotes. */
export const QUOTE_DELIVERY_ESTIMATE_KES = 300;

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  doorstep: "Deliver to my doorstep",
  dropoff: "Deliver to a drop-off point",
};

/** Admin Order Status kanban columns (map 1:1 to OrderStatus except cancelled). */
export const ORDER_KANBAN_COLUMNS = [
  { id: "pending", title: "Orders", hint: "New buyer orders" },
  { id: "awaiting_supplier", title: "Supplier Request", hint: "Request sent to supplier" },
  { id: "supplier_confirmed", title: "Supplier Response", hint: "Supplier agreed / responding" },
  { id: "confirmed", title: "Orders confirmed", hint: "Buyer notified" },
  { id: "out_for_delivery", title: "Orders out on delivery", hint: "Rider en route" },
  { id: "delivered", title: "Orders delivered", hint: "Complete — rate quality" },
] as const;

export const RATING_SUBJECT_LABELS: Record<string, string> = {
  delivery: "Delivery",
  supplier_response: "Supplier response",
  supplier_delivery: "Supplier delivery",
  goods: "Goods",
  rider: "Rider",
};

export const RATING_DIMENSION_LABELS: Record<string, string> = {
  speed: "Speed",
  turnaround: "Turnaround",
  quality_of_service: "Quality of service",
  quality_of_goods: "Quality of goods",
};
