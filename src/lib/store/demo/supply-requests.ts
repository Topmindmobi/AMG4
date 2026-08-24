"use client";

/**
 * Demo-mode supplier → AMG supply-request pipeline. Part of the
 * `demo-store.ts` module split — see that file, and the circular-import note
 * in `./orders`.
 */

import { DEMO_ORDERS } from "@/lib/demo-data";
import { formatKes, PAY_NOW_DISCOUNT_RATE, supplyRequestAgreed } from "@/lib/format";
import { matchSupplierProduct } from "@/lib/supplier-selection";
import type {
  Order,
  OrderItem,
  Product,
  Profile,
  SupplyDispatchDetails,
  SupplyLogisticsPlan,
  SupplyRequest,
  SupplyRequestStatus,
} from "@/lib/types";
import { getDemoProducts, getDemoSuppliers } from "./catalog";
import { ensureSeeded, KEYS, read, write } from "./core";
import { pushNotification } from "./notifications";
import { getDemoOrder, updateDemoOrderStatus } from "./orders";

function normalizeSupplyRequest(r: SupplyRequest): SupplyRequest {
  return {
    ...r,
    logistics: r.logistics ?? null,
    dispatch: r.dispatch ?? null,
    dispatched_at: r.dispatched_at ?? null,
    fulfilled_at: r.fulfilled_at ?? null,
    fulfilled_by: r.fulfilled_by ?? null,
  };
}

export function getDemoSupplyRequests(filters?: {
  supplierId?: string;
  orderId?: string;
}): SupplyRequest[] {
  ensureSeeded();
  let list = read<SupplyRequest[]>(KEYS.supplyRequests, []).map(normalizeSupplyRequest);
  if (filters?.supplierId) {
    list = list.filter((r) => r.supplier_id === filters.supplierId);
  }
  if (filters?.orderId) {
    list = list.filter((r) => r.order_id === filters.orderId);
  }
  return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoSupplyRequest(id: string): SupplyRequest | null {
  ensureSeeded();
  const found = read<SupplyRequest[]>(KEYS.supplyRequests, []).find((r) => r.id === id);
  return found ? normalizeSupplyRequest(found) : null;
}

/** Admin: forward a supplier's portion of an order */
export function requestSupplyFromSupplier(
  orderId: string,
  supplierId: string,
): SupplyRequest {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const suppliers = getDemoSuppliers();
  const supplier = suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const existing = getDemoSupplyRequests({ orderId, supplierId })[0];
  if (existing) return existing;

  const lines = (order.items ?? []).filter((i) => i.supplier_id === supplierId);
  if (lines.length === 0) throw new Error("No items for this supplier");

  const request: SupplyRequest = {
    id: `sr-${Date.now()}`,
    order_id: orderId,
    supplier_id: supplierId,
    supplier_name: supplier.name,
    status: "pending",
    items: lines.map((i) => ({
      order_item_id: i.id,
      product_id: i.product_id,
      name: i.name_snapshot,
      qty: i.qty,
      price_kes: i.price_kes,
    })),
    total_kes: lines.reduce((s, i) => s + i.price_kes * i.qty, 0),
    customer_town: order.town,
    delivery_note: `Supply to AMG Online Store client in ${order.town}. AMG will handle final dispatch.`,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    logistics: null,
    dispatch: null,
    dispatched_at: null,
    fulfilled_at: null,
    fulfilled_by: null,
  };

  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(KEYS.supplyRequests, [request, ...list]);
  updateDemoOrderStatus(orderId, "awaiting_supplier");

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === supplierId,
  );
  if (supplierUser) {
    const itemSummary = request.items
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");
    pushNotification({
      user_id: supplierUser.id,
      title: "New supply request from AMG Online Store",
      body: `Please supply ${itemSummary}. Total ${formatKes(request.total_kes)} for AMG's client in ${order.town}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: orderId,
      supply_request_id: request.id,
    });
  }

  return request;
}

/**
 * Admin: after comparative analysis, assign matched lines to the chosen supplier
 * and create a supply request (reassigns product/price snapshots when substituting).
 */
export function fulfillOrderWithSupplier(
  orderId: string,
  supplierId: string,
): SupplyRequest {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const supplier = getDemoSuppliers().find((s) => s.id === supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const existing = getDemoSupplyRequests({ orderId, supplierId })[0];
  if (existing) return existing;

  const products = getDemoProducts({ activeOnly: false });
  const catalogById = new Map(products.map((p) => [p.id, p]));
  const theirs = products.filter((p) => p.supplier_id === supplierId);
  const covered = (order.items ?? [])
    .map((item) => {
      const product = matchSupplierProduct(item, theirs, catalogById, supplierId);
      if (!product || product.stock < 1) return null;
      // Rival synthetic offers use id suffix __offer__ — keep the real catalog product id
      const productId = product.id.includes("__offer__")
        ? product.id.split("__offer__")[0]
        : product.id;
      return { item, product, productId };
    })
    .filter((m): m is { item: OrderItem; product: Product; productId: string } => Boolean(m));
  if (covered.length === 0) throw new Error("No stock available from this supplier");

  const coveredIds = new Set(covered.map((m) => m.item.id));
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const nextOrders = orders.map((o) => {
    if (o.id !== orderId) return o;
    const items = (o.items ?? []).map((item) => {
      const match = covered.find((m) => m.item.id === item.id);
      if (!match) return item;
      return {
        ...item,
        product_id: match.productId,
        name_snapshot: match.product.name,
        price_kes: match.product.price_kes,
        supplier_id: supplier.id,
        supplier_name_snapshot: supplier.name,
      };
    });
    const subtotal_kes = items.reduce((s, i) => s + i.price_kes * i.qty, 0);
    const discount_kes = o.paid ? Math.round(subtotal_kes * PAY_NOW_DISCOUNT_RATE) : o.discount_kes;
    return {
      ...o,
      items,
      subtotal_kes,
      discount_kes,
      total_kes: subtotal_kes - discount_kes,
    };
  });
  write(KEYS.orders, nextOrders);

  // Prefer remapped lines; fall back to classic filter after write
  const refreshed = getDemoOrder(orderId);
  const lines = (refreshed?.items ?? []).filter(
    (i) => i.supplier_id === supplierId && coveredIds.has(i.id),
  );
  if (lines.length === 0) throw new Error("No items for this supplier after matching");

  const request: SupplyRequest = {
    id: `sr-${Date.now()}`,
    order_id: orderId,
    supplier_id: supplierId,
    supplier_name: supplier.name,
    status: "pending",
    items: lines.map((i) => ({
      order_item_id: i.id,
      product_id: i.product_id,
      name: i.name_snapshot,
      qty: i.qty,
      price_kes: i.price_kes,
    })),
    total_kes: lines.reduce((s, i) => s + i.price_kes * i.qty, 0),
    customer_town: order.town,
    delivery_note: `Supply to AMG Online Store client in ${order.town}. Selected via value-for-money analysis. AMG will handle final dispatch.`,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    logistics: null,
    dispatch: null,
    dispatched_at: null,
    fulfilled_at: null,
    fulfilled_by: null,
  };

  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(KEYS.supplyRequests, [request, ...list]);
  updateDemoOrderStatus(orderId, "awaiting_supplier");

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === supplierId,
  );
  if (supplierUser) {
    const itemSummary = request.items
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");
    pushNotification({
      user_id: supplierUser.id,
      title: "New supply request from AMG Online Store",
      body: `Please supply ${itemSummary}. Total ${formatKes(request.total_kes)} for AMG's client in ${order.town}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: orderId,
      supply_request_id: request.id,
    });
  }

  return request;
}

function writeSupplyRequest(updated: SupplyRequest): SupplyRequest {
  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(
    KEYS.supplyRequests,
    list.map((r) => (r.id === updated.id ? updated : r)),
  );
  return updated;
}

function refreshOrderSupplierStatus(orderId: string) {
  const orderRequests = getDemoSupplyRequests({ orderId });
  const order = getDemoOrder(orderId);
  const assignedIds = new Set(
    (order?.items ?? [])
      .map((i) => i.supplier_id)
      .filter((id): id is string => Boolean(id)),
  );
  const allAgreed = Array.from(assignedIds).every((sid) =>
    orderRequests.some((r) => r.supplier_id === sid && supplyRequestAgreed(r.status)),
  );
  if (allAgreed && order && (order.status === "pending" || order.status === "awaiting_supplier")) {
    updateDemoOrderStatus(orderId, "supplier_confirmed");
  }
}

/** Supplier confirms they will supply and files the inbound logistics plan to AMG. */
export function confirmDemoSupplyRequest(
  requestId: string,
  logistics: SupplyLogisticsPlan,
): SupplyRequest {
  ensureSeeded();
  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  const request = list.find((r) => r.id === requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status === "dispatched" || request.status === "fulfilled") {
    throw new Error("This request can no longer be confirmed");
  }
  if (request.status === "rejected") {
    // allow re-confirm from rejected
  } else if (request.status !== "pending" && request.status !== "confirmed") {
    throw new Error("This request can no longer be confirmed");
  }
  if (!logistics.amg_location_id || !logistics.planned_dispatch_at || !logistics.method) {
    throw new Error("Logistics plan is incomplete");
  }
  if (Number.isNaN(Date.parse(logistics.planned_dispatch_at))) {
    throw new Error("Planned dispatch time is invalid");
  }

  const wasPending = request.status === "pending" || request.status === "rejected";
  const updated = writeSupplyRequest({
    ...request,
    status: "confirmed",
    confirmed_at: request.confirmed_at ?? new Date().toISOString(),
    logistics,
  });

  if (wasPending) {
    refreshOrderSupplierStatus(request.order_id);
    pushNotification({
      user_id: "demo-admin",
      title: `${request.supplier_name} confirmed supply`,
      body: `Order ${request.order_id}: logistics plan set — ${logistics.method} to ${logistics.amg_location_name} on ${new Date(logistics.planned_dispatch_at).toLocaleString()}.`,
      link: "/admin/orders",
      order_id: request.order_id,
      supply_request_id: request.id,
    });
  }

  return updated;
}

/** Supplier marks stock as dispatched toward the AMG hub with driver/vehicle details. */
export function dispatchDemoSupplyRequest(
  requestId: string,
  dispatch: SupplyDispatchDetails,
): SupplyRequest {
  ensureSeeded();
  const request = getDemoSupplyRequest(requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status !== "confirmed") {
    throw new Error("Only confirmed orders can be marked dispatched");
  }
  if (!request.logistics) {
    throw new Error(
      "Logistics plan missing — drag back to add the AMG hub plan, or open the order and save logistics first.",
    );
  }
  if (!dispatch.driver_name.trim() || !dispatch.driver_phone.trim() || !dispatch.vehicle_plate.trim()) {
    throw new Error("Driver name, phone, and vehicle plate are required");
  }

  const cleaned: SupplyDispatchDetails = {
    vehicle_type: dispatch.vehicle_type,
    driver_name: dispatch.driver_name.trim(),
    driver_phone: dispatch.driver_phone.trim(),
    vehicle_plate: dispatch.vehicle_plate.trim().toUpperCase(),
    vehicle_description: dispatch.vehicle_description?.trim() || null,
  };

  const updated = writeSupplyRequest({
    ...request,
    status: "dispatched",
    dispatch: cleaned,
    dispatched_at: new Date().toISOString(),
  });

  pushNotification({
    user_id: "demo-admin",
    title: `${request.supplier_name} dispatched to AMG`,
    body: `Order ${request.order_id}: ${cleaned.vehicle_type.toUpperCase()} ${cleaned.vehicle_plate}, driver ${cleaned.driver_name} (${cleaned.driver_phone}) → ${request.logistics.amg_location_name}.`,
    link: "/admin/orders",
    order_id: request.order_id,
    supply_request_id: request.id,
  });

  return updated;
}

/** AMG admin certifies inbound goods after inspection (supplier cannot do this). */
export function fulfillDemoSupplyRequest(
  requestId: string,
  adminUserId = "demo-admin",
): SupplyRequest {
  ensureSeeded();
  const request = getDemoSupplyRequest(requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status !== "dispatched") {
    throw new Error("Only dispatched supply can be certified fulfilled");
  }

  const updated = writeSupplyRequest({
    ...request,
    status: "fulfilled",
    fulfilled_at: new Date().toISOString(),
    fulfilled_by: adminUserId,
  });

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === request.supplier_id,
  );
  if (supplierUser) {
    pushNotification({
      user_id: supplierUser.id,
      title: "AMG certified your delivery",
      body: `Supply for order ${request.order_id} was inspected and marked fulfilled at ${request.logistics?.amg_location_name ?? "AMG hub"}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: request.order_id,
      supply_request_id: request.id,
    });
  }

  return updated;
}

/**
 * Kanban advance for suppliers: pending→confirmed needs logistics (use confirm),
 * confirmed→dispatched. Fulfilled is AMG-only.
 */
export function advanceDemoSupplyRequest(
  requestId: string,
  to: SupplyRequestStatus,
  logistics?: SupplyLogisticsPlan,
  dispatch?: SupplyDispatchDetails,
): SupplyRequest {
  if (to === "confirmed") {
    if (!logistics) throw new Error("Logistics plan required to confirm");
    return confirmDemoSupplyRequest(requestId, logistics);
  }
  if (to === "dispatched") {
    if (!dispatch) throw new Error("Driver and vehicle details required to dispatch");
    return dispatchDemoSupplyRequest(requestId, dispatch);
  }
  if (to === "fulfilled") {
    throw new Error("Only AMG can certify fulfilled after inspection");
  }
  throw new Error(`Cannot move supply request to ${to}`);
}
