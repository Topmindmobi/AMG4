"use client";

/**
 * Demo-mode rider assignment/delivery-status machine, payouts, and rider
 * roster + AMG drop-off points. Part of the `demo-store.ts` module split —
 * see that file, and the circular-import note in `./orders`. Named
 * `rider-payouts.ts` to match the domain name suggested for this split, even
 * though it also covers the rider delivery-status machine itself (the two
 * are tightly coupled in the original code — a payout is created as a
 * side-effect of the delivery status reaching "paid").
 */

import { DEMO_DROPOFF_POINTS, DEMO_ORDERS, DEMO_RIDERS } from "@/lib/demo-data";
import { formatKes, RIDER_PAYOUT_KES } from "@/lib/format";
import type {
  DropoffPoint,
  Order,
  PaymentMethod,
  Profile,
  Rider,
  RiderDeliveryEvent,
  RiderDeliveryStatus,
  RiderPayout,
  Town,
} from "@/lib/types";
import { ensureSeeded, KEYS, read, shortId, write } from "./core";
import { pushNotification } from "./notifications";
import { getDemoOrder } from "./orders";

export function dispatchDemoOrder(orderId: string, riderId: string): Order | null {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS);
  const rider = riders.find((r) => r.id === riderId);
  if (!rider) throw new Error("Rider not found");

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const assignedAt = new Date().toISOString();
  const assignEvent: RiderDeliveryEvent = {
    status: "assigned",
    at: assignedAt,
    note: `Assigned to ${rider.name}`,
  };
  const next = orders.map((o) => {
    if (o.id !== orderId) return o;
    const prevEvents = o.rider_delivery_events ?? [];
    return {
      ...o,
      status: "out_for_delivery" as const,
      rider_id: rider.id,
      rider_name_snapshot: rider.name,
      rider_vehicle_snapshot: rider.vehicle,
      rider_delivery_status: "assigned" as const,
      rider_fail_reason: null,
      rider_delivery_events: [...prevEvents, assignEvent],
    };
  });
  write(KEYS.orders, next);
  const order = next.find((o) => o.id === orderId) ?? null;

  const riderUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "rider" && p.rider_id === rider.id,
  );
  if (riderUser && order) {
    pushNotification({
      user_id: riderUser.id,
      title: "New delivery assigned",
      body: `Order ${shortId(order.id)} to ${order.town}${
        order.delivery_method === "dropoff" && order.dropoff_point_name
          ? ` (drop-off: ${order.dropoff_point_name})`
          : " (deliver to doorstep)"
      }.`,
      link: "/rider",
      order_id: order.id,
    });
  }

  if (order) {
    notifyRiderStageToCustomerAndAdmin(order, "assigned");
  }

  return order;
}

function riderStageMessage(
  order: Order,
  status: RiderDeliveryStatus,
): { customerTitle: string; customerBody: string; adminTitle: string; adminBody: string } {
  const rider = order.rider_name_snapshot || "Rider";
  const ref = shortId(order.id);
  const map: Record<
    RiderDeliveryStatus,
    { customerTitle: string; customerBody: string; adminTitle: string; adminBody: string }
  > = {
    assigned: {
      customerTitle: "Rider assigned to your order",
      customerBody: `${rider} will deliver order ${ref} to you in ${order.town}.`,
      adminTitle: `Rider assigned — ${rider}`,
      adminBody: `${rider} assigned to order ${ref} (${order.customer_name}, ${order.town}).`,
    },
    collected: {
      customerTitle: "Rider collected your order",
      customerBody: `${rider} collected order ${ref} from the AMG hub and will head out shortly.`,
      adminTitle: `Collected for delivery — ${rider}`,
      adminBody: `${rider} collected order ${ref} from hub.`,
    },
    in_transit: {
      customerTitle: "Your order is in transit",
      customerBody: `${rider} is on the way with order ${ref}.`,
      adminTitle: `In transit — ${rider}`,
      adminBody: `${rider} is in transit with order ${ref} to ${order.customer_name}.`,
    },
    delivered: {
      customerTitle: "Order delivered",
      customerBody: `${rider} handed over order ${ref}. Complete payment with the rider if still unpaid.`,
      adminTitle: `Delivered — ${rider}`,
      adminBody: `${rider} marked order ${ref} delivered${order.paid ? "" : " (payment pending)"}.`,
    },
    paid: {
      customerTitle: "Payment received — delivery complete",
      customerBody: `Payment for order ${ref} is registered. Thank you for shopping with AMG Online Store.`,
      adminTitle: `Paid — trip closed`,
      adminBody: `Order ${ref} paid and closed by ${rider}.`,
    },
    failed: {
      customerTitle: "Delivery could not be completed",
      customerBody: `${rider} could not complete delivery for order ${ref}${
        order.rider_fail_reason ? `: ${order.rider_fail_reason}` : ""
      }. AMG will contact you.`,
      adminTitle: `Fail delivery — ${rider}`,
      adminBody: `${rider} failed order ${ref}${
        order.rider_fail_reason ? `: ${order.rider_fail_reason}` : ""
      }.`,
    },
  };
  return map[status];
}

function notifyRiderStageToCustomerAndAdmin(
  order: Order,
  status: RiderDeliveryStatus,
) {
  const msg = riderStageMessage(order, status);
  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: msg.customerTitle,
      body: msg.customerBody,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }
  pushNotification({
    user_id: "demo-admin",
    title: msg.adminTitle,
    body: msg.adminBody,
    link: "/admin/orders",
    order_id: order.id,
  });
}

/** Resolve the portal user id linked to a rider record (for push / in-app alerts). */
export function getDemoUserIdForRider(riderId: string): string | null {
  ensureSeeded();
  return (
    read<Profile[]>(KEYS.profiles, []).find(
      (p) => p.role === "rider" && p.rider_id === riderId,
    )?.id ?? null
  );
}

/**
 * Rider registers payment before leaving the customer.
 * COD = cash collected; mpesa = STK confirmed at the door.
 */
/** In-app alert to the customer when the rider sends a door-side M-Pesa STK. */
export function notifyDemoDoorMpesaPrompt(orderId: string, phone: string): void {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order?.user_id) return;
  pushNotification({
    user_id: order.user_id,
    title: "Confirm M-Pesa on your phone",
    body: `AMG rider sent a payment request for ${formatKes(Number(order.total_kes))} to ${phone}. Enter your M-Pesa PIN — the rider will wait until it confirms.`,
    link: `/order/${order.id}`,
    order_id: order.id,
  });
}

export function markDemoOrderPaid(
  orderId: string,
  input: {
    method: PaymentMethod;
    note?: string | null;
    mpesa_phone?: string | null;
  },
): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (
    order.status !== "out_for_delivery" &&
    order.status !== "confirmed" &&
    order.status !== "delivered"
  ) {
    throw new Error("Only orders in delivery can be marked paid here");
  }
  if (order.paid) {
    if (normalizeRiderDeliveryStatus(order) === "delivered") {
      return setDemoRiderDeliveryStatus(orderId, "paid");
    }
    return order;
  }

  const paidAt = new Date().toISOString();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const stage = normalizeRiderDeliveryStatus(order);
  const closeTrip = stage === "delivered" || stage === "paid";
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          paid: true,
          paid_at: paidAt,
          payment_method: input.method,
          mpesa_phone:
            input.method === "mpesa"
              ? input.mpesa_phone || o.mpesa_phone || o.phone
              : o.mpesa_phone,
        }
      : o,
  );
  write(KEYS.orders, next);

  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Payment received",
      body: `Payment of ${formatKes(Number(order.total_kes))} for order ${shortId(order.id)} was registered (${input.method === "mpesa" ? "M-Pesa" : "cash"}).`,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }

  // Goods already handed over → close on Paid column (events + admin/customer stage notice)
  if (closeTrip && order.rider_id) {
    return setDemoRiderDeliveryStatus(orderId, "paid");
  }

  if (order.rider_id) {
    const riderUserId = getDemoUserIdForRider(order.rider_id);
    if (riderUserId) {
      pushNotification({
        user_id: riderUserId,
        title: "Payment registered",
        body: `Order ${shortId(order.id)} is paid. Move it to Delivered / Paid when goods are handed over.`,
        link: "/rider",
        order_id: order.id,
      });
    }
  }

  return getDemoOrder(orderId)!;
}

/** Infer kanban column for legacy orders missing rider_delivery_status. */
export function normalizeRiderDeliveryStatus(order: Order): RiderDeliveryStatus {
  if (order.rider_delivery_status) return order.rider_delivery_status;
  if (order.status === "delivered") return order.paid ? "paid" : "delivered";
  if (order.status === "out_for_delivery") return "assigned";
  return "assigned";
}

function ensureRiderPayout(order: Order, at: string): RiderPayout | null {
  if (!order.rider_id) return null;
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  const existing = payouts.find((p) => p.order_id === order.id);
  if (existing) return existing;
  const payout: RiderPayout = {
    id: `payout-${Date.now()}`,
    order_id: order.id,
    rider_id: order.rider_id,
    rider_name: order.rider_name_snapshot ?? "Rider",
    amount_kes: RIDER_PAYOUT_KES,
    status: "sent",
    created_at: at,
  };
  write(KEYS.riderPayouts, [payout, ...payouts]);
  const riderUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "rider" && p.rider_id === order.rider_id,
  );
  if (riderUser) {
    pushNotification({
      user_id: riderUser.id,
      title: "Delivery payment sent",
      body: `Payment of ${formatKes(RIDER_PAYOUT_KES)} sent for order ${shortId(order.id)}.`,
      link: "/rider",
      order_id: order.id,
    });
  }
  return payout;
}

/** Close trip after payment on the Paid column (payout + customer notice). */
function finalizeRiderPaidDelivery(orderId: string): {
  order: Order;
  payout: RiderPayout | null;
} {
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const at = order.delivered_at || new Date().toISOString();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "delivered" as const,
          delivered_at: o.delivered_at || at,
          rider_delivery_status: "paid" as const,
        }
      : o,
  );
  write(KEYS.orders, next);
  const updated = next.find((o) => o.id === orderId)!;
  const payout = order.paid ? ensureRiderPayout(updated, at) : null;
  return { order: updated, payout };
}

/**
 * Advance (or set) the rider kanban stage.
 * Paid requires order.paid === true. Failed accepts an optional reason.
 */
export function setDemoRiderDeliveryStatus(
  orderId: string,
  to: RiderDeliveryStatus,
  opts?: { failReason?: string | null },
): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.rider_id) throw new Error("Order is not assigned to a rider");

  if (to === "paid" && !order.paid) {
    throw new Error("Collect M-Pesa or cash before moving to Paid");
  }

  const current = normalizeRiderDeliveryStatus(order);
  if (current === to && to !== "failed") {
    return order;
  }

  const now = new Date().toISOString();
  const failReason =
    to === "failed" ? opts?.failReason?.trim() || "Delivery failed" : null;
  const event: RiderDeliveryEvent = {
    status: to,
    at: now,
    note:
      to === "failed"
        ? failReason
        : to === "assigned"
          ? `Assigned to ${order.rider_name_snapshot || "rider"}`
          : null,
  };

  let patch: Partial<Order> = {
    rider_delivery_status: to,
    rider_fail_reason: failReason,
    rider_delivery_events: [...(order.rider_delivery_events ?? []), event],
  };

  if (to === "delivered" || to === "paid") {
    patch = {
      ...patch,
      status: "delivered",
      delivered_at: order.delivered_at || now,
      archived_at: order.archived_at || now,
    };
  } else if (to === "failed") {
    patch = {
      ...patch,
      status: "out_for_delivery",
    };
  } else {
    patch = {
      ...patch,
      status: "out_for_delivery",
      delivered_at: null,
      archived_at: null,
    };
  }

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  write(
    KEYS.orders,
    orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
  );

  let updated = getDemoOrder(orderId)!;

  if (to === "paid") {
    updated = finalizeRiderPaidDelivery(orderId).order;
  }

  notifyRiderStageToCustomerAndAdmin(updated, to);
  return updated;
}

/** @deprecated Prefer setDemoRiderDeliveryStatus — kept for admin/order-status paths. */
export function deliverDemoOrder(orderId: string): { order: Order; payout: RiderPayout | null } {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.paid) {
    throw new Error(
      "Payment not registered. Collect cash or confirm M-Pesa before closing as Paid.",
    );
  }
  setDemoRiderDeliveryStatus(orderId, "delivered");
  const closed = setDemoRiderDeliveryStatus(orderId, "paid");
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  return {
    order: closed,
    payout: payouts.find((p) => p.order_id === orderId) ?? null,
  };
}

export function getDemoRiders(town?: Town): Rider[] {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS).filter((r) => r.active);
  return town ? riders.filter((r) => r.town === town) : riders;
}

/** Unfiltered rider list (including inactive) for admin management. */
export function getAllDemoRiders(): Rider[] {
  ensureSeeded();
  return read<Rider[]>(KEYS.riders, DEMO_RIDERS);
}

export function upsertDemoRider(
  data: Partial<Rider> & { name: string },
): Rider {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS);
  if (data.id) {
    const next = riders.map((r) => (r.id === data.id ? { ...r, ...data } : r));
    write(KEYS.riders, next);
    return next.find((r) => r.id === data.id)!;
  }
  const rider: Rider = {
    id: `rider-${Date.now()}`,
    name: data.name,
    phone: data.phone ?? null,
    town: data.town ?? null,
    vehicle: data.vehicle ?? "boda",
    active: data.active ?? true,
    created_at: new Date().toISOString(),
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    maps_url: data.maps_url ?? null,
  };
  write(KEYS.riders, [rider, ...riders]);
  return rider;
}

export function getDemoDropoffPoints(town?: Town): DropoffPoint[] {
  ensureSeeded();
  const points = read<DropoffPoint[]>(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  return town ? points.filter((p) => p.town === town) : points;
}

export function getDemoRiderOrders(riderId: string): Order[] {
  ensureSeeded();
  return read<Order[]>(KEYS.orders, DEMO_ORDERS)
    .filter((o) => o.rider_id === riderId)
    .map((o) => ({
      ...o,
      rider_delivery_status: normalizeRiderDeliveryStatus(o),
    }))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoRiderPayouts(riderId?: string): RiderPayout[] {
  ensureSeeded();
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  const list = riderId ? payouts.filter((p) => p.rider_id === riderId) : payouts;
  return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}
