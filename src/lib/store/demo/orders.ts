"use client";

/**
 * Demo-mode order creation/status. Part of the `demo-store.ts` module split
 * — see that file.
 *
 * `adminRecordSupplierResponse` intentionally imports from `./supply-requests`
 * and `./rider-payouts`, which in turn import `getDemoOrder`/`updateDemoOrderStatus`
 * back from this module — a deliberate circular import that mirrors the
 * original single-file code's own coupling between these concerns. This is
 * safe in ES modules as long as nothing at module-evaluation time (only
 * inside function bodies) depends on the other module's exports before it
 * has finished initializing, which is the case for every call site here.
 */

import { DEMO_DROPOFF_POINTS, DEMO_ORDERS, DEMO_PRODUCTS, DEMO_SUPPLIERS } from "@/lib/demo-data";
import { formatKes, PAY_NOW_DISCOUNT_RATE } from "@/lib/format";
import type { DeliveryMethod, DropoffPoint, Order, OrderItem, PaymentMethod, Product, Supplier, Town } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";
import { pushNotification } from "./notifications";
import { confirmDemoSupplyRequest, getDemoSupplyRequests } from "./supply-requests";
import { getDemoDropoffPoints } from "./rider-payouts";
import type { SupplyLogisticsPlan } from "@/lib/types";

export function getDemoOrders(userId?: string): Order[] {
  ensureSeeded();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const filtered = userId ? orders.filter((o) => o.user_id === userId) : orders;
  return filtered.sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export function getDemoOrder(id: string): Order | null {
  ensureSeeded();
  return read<Order[]>(KEYS.orders, DEMO_ORDERS).find((o) => o.id === id) ?? null;
}

export function createDemoOrder(input: {
  user_id: string | null;
  customer_name: string;
  phone: string;
  email?: string | null;
  town: Town;
  address: string;
  payment_method: PaymentMethod;
  mpesa_phone: string | null;
  /** True when payment was actually confirmed online (M-Pesa pay-now) before submit. */
  paid: boolean;
  delivery_method: DeliveryMethod;
  dropoff_point_id?: string | null;
  items: { productId: string; name: string; price_kes: number; qty: number }[];
}): Order {
  ensureSeeded();
  const id = `ord-${Date.now()}`;
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const suppliers = read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
  const items: OrderItem[] = input.items.map((item, i) => {
    const product = products.find((p) => p.id === item.productId);
    const supplier = suppliers.find((s) => s.id === product?.supplier_id);
    return {
      id: `${id}-i${i}`,
      order_id: id,
      product_id: item.productId,
      name_snapshot: item.name,
      price_kes: item.price_kes,
      qty: item.qty,
      supplier_id: product?.supplier_id ?? null,
      supplier_name_snapshot: supplier?.name ?? null,
    };
  });
  const subtotal_kes = items.reduce((sum, i) => sum + i.price_kes * i.qty, 0);
  const discount_kes = input.paid ? Math.round(subtotal_kes * PAY_NOW_DISCOUNT_RATE) : 0;
  const total_kes = subtotal_kes - discount_kes;
  const dropoffPoints = read<DropoffPoint[]>(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  const dropoff =
    input.delivery_method === "dropoff"
      ? dropoffPoints.find((d) => d.id === input.dropoff_point_id) ?? null
      : null;

  const order: Order = {
    id,
    user_id: input.user_id,
    customer_name: input.customer_name,
    phone: input.phone,
    email: input.email ?? null,
    town: input.town,
    address: input.address,
    payment_method: input.payment_method,
    mpesa_phone: input.mpesa_phone,
    paid: input.paid,
    paid_at: input.paid ? new Date().toISOString() : null,
    subtotal_kes,
    discount_kes,
    delivery_method: input.delivery_method,
    dropoff_point_id: dropoff?.id ?? null,
    dropoff_point_name: dropoff?.name ?? null,
    rider_id: null,
    rider_name_snapshot: null,
    delivered_at: null,
    status: "pending",
    total_kes,
    created_at: new Date().toISOString(),
    buyer_notified_at: null,
    items,
  };
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  write(KEYS.orders, [order, ...orders]);

  const updated = products.map((p) => {
    const line = input.items.find((i) => i.productId === p.id);
    if (!line) return p;
    return { ...p, stock: Math.max(0, p.stock - line.qty) };
  });
  write(KEYS.products, updated);

  const paidNote = input.paid
    ? ` Paid online (5% discount applied, ${formatKes(discount_kes)} off).`
    : " Cash on delivery.";
  pushNotification({
    user_id: "demo-admin",
    title: "New customer order",
    body: `${order.customer_name} placed an order for ${formatKes(total_kes)}.${paidNote} Forward items to suppliers.`,
    link: "/admin/orders",
    order_id: order.id,
  });

  return order;
}

export function updateDemoOrderStatus(id: string, status: Order["status"]): Order | null {
  ensureSeeded();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) => {
    if (o.id !== id) return o;
    if (status === "delivered" && o.status !== "delivered") {
      const now = new Date().toISOString();
      return { ...o, status, delivered_at: o.delivered_at ?? now, archived_at: o.archived_at ?? now };
    }
    return { ...o, status };
  });
  write(KEYS.orders, next);
  return next.find((o) => o.id === id) ?? null;
}

/** Admin confirms order to the buyer after supplier confirmations */
export function confirmOrderToBuyer(orderId: string): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "confirmed" as const,
          buyer_notified_at: new Date().toISOString(),
        }
      : o,
  );
  write(KEYS.orders, next);

  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Your AMG Online Store order is confirmed",
      body: `Order ${orderId} is confirmed. We will dispatch soon to ${order.town}.`,
      link: `/order/${orderId}`,
      order_id: orderId,
    });
  }

  return next.find((o) => o.id === orderId)!;
}

/**
 * Admin records that the supplier has responded (agreed).
 * Confirms any pending supply requests with a stub logistics plan and
 * moves the order to supplier_confirmed.
 */
export function adminRecordSupplierResponse(orderId: string): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");

  const pending = getDemoSupplyRequests({ orderId }).filter((r) => r.status === "pending");
  const hubs = getDemoDropoffPoints(order.town);
  const hub = hubs[0];
  const stubLogistics: SupplyLogisticsPlan = {
    method: "boda",
    amg_location_id: hub?.id ?? "drop-homabay-1",
    amg_location_name: hub?.name ?? "AMG Hub",
    amg_location_town: hub?.town ?? order.town,
    planned_dispatch_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
    notes: "Recorded by AMG admin from Order Status board",
  };

  for (const req of pending) {
    confirmDemoSupplyRequest(req.id, stubLogistics);
  }

  updateDemoOrderStatus(orderId, "supplier_confirmed");
  return getDemoOrder(orderId)!;
}
