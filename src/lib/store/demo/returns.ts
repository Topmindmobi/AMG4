"use client";

/**
 * Demo-mode return requests. Part of the `demo-store.ts` module split — see
 * that file. Mirrors the production `request_return`/`admin_resolve_return`
 * RPCs (033_return_requests.sql): 7-day window from `delivered_at`, one open
 * (requested/approved) request per order, admin-only resolution.
 */

import type { ReturnReason, ReturnRequest, ReturnRequestItem, ReturnRequestStatus } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";
import { pushNotification } from "./notifications";
import { getDemoOrder } from "./orders";

const RETURN_WINDOW_DAYS = 7;

export function getDemoReturnRequests(userId?: string): ReturnRequest[] {
  ensureSeeded();
  const list = read<ReturnRequest[]>(KEYS.returnRequests, []);
  const filtered = userId ? list.filter((r) => r.user_id === userId) : list;
  return filtered.sort((a, b) => +new Date(b.requested_at) - +new Date(a.requested_at));
}

export function getDemoReturnRequestForOrder(orderId: string): ReturnRequest | null {
  ensureSeeded();
  const list = read<ReturnRequest[]>(KEYS.returnRequests, []);
  return (
    list
      .filter((r) => r.order_id === orderId)
      .sort((a, b) => +new Date(b.requested_at) - +new Date(a.requested_at))[0] ?? null
  );
}

export function isDemoReturnWindowOpen(orderId: string): boolean {
  const order = getDemoOrder(orderId);
  if (!order || order.status !== "delivered" || !order.delivered_at) return false;
  const deadline = new Date(order.delivered_at).getTime() + RETURN_WINDOW_DAYS * 24 * 3600_000;
  return Date.now() <= deadline;
}

export function requestDemoReturn(input: {
  orderId: string;
  userId: string;
  reason: ReturnReason;
  reasonNotes?: string | null;
  items: { orderItemId: string; qty: number }[];
}): ReturnRequest {
  ensureSeeded();
  const order = getDemoOrder(input.orderId);
  if (!order) throw new Error("Order not found");
  if (order.user_id !== input.userId) throw new Error("Not your order");
  if (order.status !== "delivered" || !order.delivered_at) {
    throw new Error("Order must be delivered before a return can be requested");
  }
  if (!isDemoReturnWindowOpen(input.orderId)) {
    throw new Error(`Return window (${RETURN_WINDOW_DAYS} days after delivery) has closed`);
  }

  const list = read<ReturnRequest[]>(KEYS.returnRequests, []);
  const hasOpen = list.some(
    (r) => r.order_id === input.orderId && (r.status === "requested" || r.status === "approved"),
  );
  if (hasOpen) throw new Error("A return is already in progress for this order");
  if (input.items.length === 0) throw new Error("Select at least one item to return");

  for (const item of input.items) {
    const orderItem = order.items?.find((i) => i.id === item.orderItemId);
    if (!orderItem) throw new Error(`Item ${item.orderItemId} does not belong to this order`);
    if (item.qty < 1 || item.qty > orderItem.qty) {
      throw new Error(`Invalid quantity for item ${item.orderItemId}`);
    }
  }

  const now = new Date().toISOString();
  const id = `ret-${Date.now()}`;
  const items: ReturnRequestItem[] = input.items.map((item, i) => ({
    id: `${id}-i${i}`,
    return_request_id: id,
    order_item_id: item.orderItemId,
    qty: item.qty,
  }));
  const request: ReturnRequest = {
    id,
    order_id: input.orderId,
    user_id: input.userId,
    status: "requested",
    reason: input.reason,
    reason_notes: input.reasonNotes?.trim() || null,
    requested_at: now,
    resolved_at: null,
    resolved_by: null,
    refund_amount_kes: null,
    admin_notes: null,
    items,
  };
  write(KEYS.returnRequests, [request, ...list]);

  pushNotification({
    user_id: "demo-admin",
    title: "New return request",
    body: `${order.customer_name} requested a return for order ${input.orderId}.`,
    link: "/admin/returns",
    order_id: input.orderId,
  });

  return request;
}

export function adminResolveDemoReturn(input: {
  returnId: string;
  status: Extract<ReturnRequestStatus, "approved" | "rejected" | "refunded">;
  adminNotes?: string | null;
  refundAmountKes?: number | null;
}): ReturnRequest {
  ensureSeeded();
  const list = read<ReturnRequest[]>(KEYS.returnRequests, []);
  const current = list.find((r) => r.id === input.returnId);
  if (!current) throw new Error("Return request not found");
  if (input.status === "refunded" && current.status !== "approved") {
    throw new Error("Can only mark refunded after approval");
  }
  if ((input.status === "approved" || input.status === "rejected") && current.status !== "requested") {
    throw new Error("Return is no longer pending");
  }

  const now = new Date().toISOString();
  const updated: ReturnRequest = {
    ...current,
    status: input.status,
    admin_notes: input.adminNotes?.trim() || current.admin_notes,
    refund_amount_kes: input.status === "refunded" ? input.refundAmountKes ?? null : current.refund_amount_kes,
    resolved_at: current.resolved_at ?? now,
    resolved_by: current.resolved_by ?? "demo-admin",
  };
  write(
    KEYS.returnRequests,
    list.map((r) => (r.id === input.returnId ? updated : r)),
  );

  pushNotification({
    user_id: current.user_id,
    title: `Return ${input.status}`,
    body: `Your return request for order ${current.order_id} was marked ${input.status}.`,
    link: `/order/${current.order_id}`,
    order_id: current.order_id,
  });

  return updated;
}
