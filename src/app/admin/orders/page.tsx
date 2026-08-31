"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/Pagination";
import { SupplierCompareDialog } from "@/components/admin/SupplierCompareDialog";
import { RiderDeliveryTracker } from "@/components/orders/RiderDeliveryTracker";
import { listRiders } from "@/lib/data/delivery";
import {
  DELIVERY_METHOD_LABELS,
  formatKes,
  ORDER_STATUS_LABELS,
  RIDER_VEHICLE_LABELS,
  SUPPLY_METHOD_LABELS,
  SUPPLY_STATUS_LABELS,
  SUPPLY_VEHICLE_LABELS,
  supplyRequestAgreed,
} from "@/lib/format";
import { groupOrderBySupplier } from "@/lib/orders";
import { notifyOrderStatus } from "@/lib/notifications/notify-client";
import { notifyRiderDispatchPush } from "@/lib/push/subscribe-client";
import { isDemoMode } from "@/lib/supabase/config";
import {
  rankSuppliersForOrder,
  refineSelectionWithAi,
  type SupplierSelectionResult,
} from "@/lib/supplier-selection";
import {
  confirmOrderToBuyer,
  dispatchDemoOrder,
  fulfillDemoSupplyRequest,
  fulfillOrderWithSupplier,
  getDemoOrders,
  getDemoProducts,
  getDemoSupplierAddresses,
  getDemoSuppliers,
  getDemoSupplyRequests,
  getDemoUserIdForRider,
  updateDemoOrderStatus,
} from "@/lib/store/demo-store";
import type {
  Order,
  OrderStatus,
  Product,
  Rider,
  Supplier,
  SupplierAddress,
  SupplyRequest,
} from "@/lib/types";

/** Mirrors set_order_status()'s forward-only map (022_order_status_transitions.sql)
 * so the UI can warn before sending a transition the server will only accept
 * via its narrow p_force override. */
const ORDER_STATUS_FORWARD_MAP: Record<OrderStatus, OrderStatus[]> = {
  pending: ["awaiting_supplier", "confirmed", "cancelled"],
  awaiting_supplier: ["supplier_confirmed", "confirmed", "cancelled"],
  supplier_confirmed: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const ORDERS_PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [supplyByOrder, setSupplyByOrder] = useState<Record<string, SupplyRequest[]>>(
    {},
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addresses, setAddresses] = useState<SupplierAddress[]>([]);
  const [ridersByTown, setRidersByTown] = useState<Record<string, Rider[]>>({});
  const [riderChoice, setRiderChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [compareOrderId, setCompareOrderId] = useState<string | null>(null);
  const [selection, setSelection] = useState<SupplierSelectionResult | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function load() {
    if (isDemoMode()) {
      void Promise.resolve().then(() => {
        const all = getDemoOrders();
        setTotalOrders(all.length);
        const list = all.slice(page * ORDERS_PAGE_SIZE, page * ORDERS_PAGE_SIZE + ORDERS_PAGE_SIZE);
        setOrders(list);
        setSuppliers(getDemoSuppliers());
        setProducts(getDemoProducts({ activeOnly: false }));
        setAddresses(getDemoSupplierAddresses());
        const map: Record<string, SupplyRequest[]> = {};
        for (const o of list) {
          map[o.id] = getDemoSupplyRequests({ orderId: o.id });
        }
        setSupplyByOrder(map);
      });
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const from = page * ORDERS_PAGE_SIZE;
      const to = from + ORDERS_PAGE_SIZE - 1;
      const [{ data, count }, { data: sups }, { data: prods }, { data: supplyData }, { data: addrs }] =
        await Promise.all([
          supabase
            .from("orders")
            .select("*, items:order_items(*)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to),
          supabase.from("suppliers").select("*"),
          // Full products catalog is a supporting dataset for supplier ranking
          // (rankSuppliersForOrder needs every product to match against), not
          // the paginated list itself — left unbounded on purpose.
          supabase.from("products").select("*"),
          supabase.from("supply_requests").select("*"),
          // Was never fetched in production — rankSuppliersForOrder silently
          // fell back to town-level distance for every supplier regardless
          // of their actual pinned address (see 027_supplier_addresses.sql).
          supabase.from("supplier_addresses").select("*"),
        ]);
      setOrders((data as Order[]) ?? []);
      setTotalOrders(count ?? null);
      setSuppliers((sups as Supplier[]) ?? []);
      setProducts((prods as Product[]) ?? []);
      setAddresses((addrs as SupplierAddress[]) ?? []);
      const map: Record<string, SupplyRequest[]> = {};
      for (const r of (supplyData as SupplyRequest[]) ?? []) {
        (map[r.order_id] ??= []).push(r);
      }
      setSupplyByOrder(map);
    })();
  }

  useEffect(() => {
    load();
    if (!isDemoMode()) return;
    const poll = setInterval(load, 5000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const towns = Array.from(new Set(orders.map((o) => o.town)));
    void Promise.all(towns.map((t) => listRiders(t).then((riders) => [t, riders] as const))).then(
      (pairs) => setRidersByTown(Object.fromEntries(pairs)),
    );
  }, [orders]);

  const rankings = useMemo(() => {
    const map: Record<string, SupplierSelectionResult> = {};
    for (const order of orders) {
      map[order.id] = rankSuppliersForOrder(order, suppliers, products, addresses);
    }
    return map;
  }, [orders, suppliers, products, addresses]);

  async function openCompare(order: Order) {
    setCompareOrderId(order.id);
    setAiLoading(true);
    const local = rankSuppliersForOrder(order, suppliers, products, addresses);
    setSelection(local);
    setSelectedSupplierId(local.recommended?.supplier.id ?? null);
    const refined = await refineSelectionWithAi(order, local);
    setSelection(refined);
    setSelectedSupplierId(refined.recommended?.supplier.id ?? null);
    setAiLoading(false);
  }

  async function confirmSupplierOrder() {
    if (!compareOrderId || !selectedSupplierId) return;
    setBusy(`fulfill-${compareOrderId}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        fulfillOrderWithSupplier(compareOrderId, selectedSupplierId);
        setMessage("Supply request sent to the selected supplier (best-value analysis applied).");
        setCompareOrderId(null);
        setSelection(null);
        load();
        return;
      }

      const card = selection?.scorecards.find((s) => s.supplier.id === selectedSupplierId);
      if (!card) throw new Error("Supplier not found");
      const lines = card.matches
        .filter((m) => m.product && m.availableQty > 0)
        .map((m) => ({
          order_item_id: m.orderItem.id,
          product_id: m.product!.id.includes("__offer__")
            ? m.product!.id.split("__offer__")[0]
            : m.product!.id,
          name: m.product!.name,
          qty: m.orderItem.qty,
          price_kes: m.unitPrice,
        }));
      if (lines.length === 0) throw new Error("No stock available from this supplier");

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_assign_supplier_to_order", {
        p_order_id: compareOrderId,
        p_supplier_id: selectedSupplierId,
        p_lines: lines,
      });
      if (error) throw error;

      setMessage("Supply request sent to the selected supplier (best-value analysis applied).");
      setCompareOrderId(null);
      setSelection(null);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function certifyFulfilled(sr: SupplyRequest, supplierName: string) {
    setBusy(`fulfill-${sr.id}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        fulfillDemoSupplyRequest(sr.id);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("admin_fulfill_supply_request", {
          p_request_id: sr.id,
        });
        if (error) throw error;
      }
      setMessage(`Certified ${supplierName} supply as fulfilled after inspection.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmBuyer(order: Order) {
    setBusy(`confirm-${order.id}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        confirmOrderToBuyer(order.id);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase
          .from("orders")
          .update({ status: "confirmed", buyer_notified_at: new Date().toISOString() })
          .eq("id", order.id);
        if (error) throw error;
      }
      await notifyOrderStatus({
        orderId: order.id,
        phone: order.phone,
        email: order.email,
        event: "confirmed",
      });
      setMessage("Buyer notified — order confirmed.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function dispatch(order: Order) {
    const riderId = riderChoice[order.id];
    if (!riderId) {
      setMessage("Choose a rider before dispatching.");
      return;
    }
    setBusy(`dispatch-${order.id}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        dispatchDemoOrder(order.id, riderId);
        const riderUserId = getDemoUserIdForRider(riderId);
        if (riderUserId) {
          await notifyRiderDispatchPush({
            userId: riderUserId,
            orderId: order.id,
            town: order.town,
            totalKes: Number(order.total_kes),
            customerName: order.customer_name,
          });
        }
      } else {
        const rider = (ridersByTown[order.town] || []).find((r) => r.id === riderId);
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase
          .from("orders")
          .update({
            status: "out_for_delivery",
            rider_id: riderId,
            rider_name_snapshot: rider?.name ?? null,
            rider_vehicle_snapshot: rider?.vehicle ?? null,
          })
          .eq("id", order.id);
        if (error) throw error;

        const { data: riderProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "rider")
          .eq("rider_id", riderId)
          .maybeSingle();
        if (riderProfile?.id) {
          await notifyRiderDispatchPush({
            userId: riderProfile.id,
            orderId: order.id,
            town: order.town,
            totalKes: Number(order.total_kes),
            customerName: order.customer_name,
          });
        }
      }
      await notifyOrderStatus({
        orderId: order.id,
        phone: order.phone,
        email: order.email,
        event: "dispatched",
      });
      setMessage("Order dispatched — rider notified (in-app + push).");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: OrderStatus) {
    if (isDemoMode()) {
      updateDemoOrderStatus(id, status);
      load();
      return;
    }

    const current = orders.find((o) => o.id === id)?.status;
    if (current === status) return;
    const forward = current ? ORDER_STATUS_FORWARD_MAP[current] ?? [] : [];
    let force = false;
    if (current && !forward.includes(status)) {
      const proceed = window.confirm(
        `Move this order from "${ORDER_STATUS_LABELS[current]}" to "${ORDER_STATUS_LABELS[status]}"? ` +
          "This is a backward or unusual transition and will be forced.",
      );
      if (!proceed) return;
      force = true;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.rpc("set_order_status", {
      p_order_id: id,
      p_to: status,
      p_force: force,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    load();
  }

  const compareOrder = orders.find((o) => o.id === compareOrderId) ?? null;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Orders</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Rank suppliers by value for money → compare availability, landed cost (goods +
        transport from supplier address) &amp; distance → order from the
        recommended supplier → confirm to buyer → dispatch.
      </p>
      {message && (
        <p className="mt-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
          {message}
        </p>
      )}
      <ul className="mt-8 space-y-6">
        {orders.map((order) => {
          const groups = groupOrderBySupplier(order, supplyByOrder[order.id] || []);
          const assigned = groups.filter((g) => g.supplier_id);
          const allConfirmed =
            assigned.length > 0 &&
            assigned.every(
              (g) => g.supply_request && supplyRequestAgreed(g.supply_request.status),
            );
          const canConfirmBuyer =
            order.status === "supplier_confirmed" ||
            (order.status === "awaiting_supplier" && allConfirmed) ||
            (assigned.length === 0 &&
              (order.status === "pending" || order.status === "awaiting_supplier"));
          const riders = ridersByTown[order.town] || [];
          const rank = rankings[order.id];
          const openForSourcing =
            order.status === "pending" ||
            order.status === "awaiting_supplier" ||
            order.status === "supplier_confirmed";
          const alreadyRequested = (supplyByOrder[order.id] || []).length > 0;

          return (
            <li key={order.id} className="border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/order/${order.id}`} className="font-medium hover:text-ember">
                    {order.customer_name}
                  </Link>
                  <p className="mt-1 text-xs text-ink-soft">
                    {order.phone} · {order.town} · {order.payment_method.toUpperCase()}
                    {order.paid ? " (paid online)" : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {DELIVERY_METHOD_LABELS[order.delivery_method]}
                    {order.delivery_method === "dropoff" && order.dropoff_point_name
                      ? ` — ${order.dropoff_point_name}`
                      : ""}
                    {order.rider_name_snapshot ? ` · Rider: ${order.rider_name_snapshot}` : ""}
                    {order.rider_vehicle_snapshot
                      ? ` (${RIDER_VEHICLE_LABELS[order.rider_vehicle_snapshot] ?? order.rider_vehicle_snapshot})`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {order.id} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {order.discount_kes > 0 && (
                    <p className="text-xs text-ink-soft line-through">{formatKes(order.subtotal_kes)}</p>
                  )}
                  <p className="font-semibold text-ember">
                    {formatKes(Number(order.total_kes))}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {ORDER_STATUS_LABELS[order.status]}
                  </p>
                </div>
              </div>

              <RiderDeliveryTracker order={order} audience="admin" />

              {/* Ranked suppliers — best value first */}
              {rank && rank.scorecards.length > 0 && (
                <div className="mt-4 rounded-lg border border-line bg-sand px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {rank.scorecards.length} supplier{rank.scorecards.length === 1 ? "" : "s"} · best
                      value first
                    </p>
                    {openForSourcing && !alreadyRequested && (
                      <button
                        type="button"
                        onClick={() => void openCompare(order)}
                        className="bg-ember px-3 py-2 text-xs font-semibold text-white"
                      >
                        Compare &amp; order
                      </button>
                    )}
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {rank.scorecards.map((card) => (
                      <li
                        key={card.supplier.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-charcoal">
                          <span className="font-semibold text-forest">#{card.rank}</span>{" "}
                          {card.supplier.name}
                          {card.isRecommended && (
                            <span className="ml-2 text-xs font-semibold text-ember">Best value</span>
                          )}
                        </span>
                        <span className="text-xs text-ink-soft">
                          Value {card.valueScore} · Avail {card.availabilityScore} · Landed{" "}
                          {formatKes(card.landedKes)} · ~{card.distanceKm} km
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.supplier_id || "unassigned"}
                    className="border border-line bg-sand p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {group.supplier_name}
                          <span className="ml-2 text-xs font-normal text-ink-soft">
                            (admin only — hidden from shoppers)
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {group.items
                            .map((i) => `${i.qty}× ${i.name_snapshot}`)
                            .join(" · ")}
                        </p>
                        <p className="mt-1 text-xs text-ember">
                          Subtotal {formatKes(group.total_kes)}
                        </p>
                      </div>
                      {group.supplier_id && group.supply_request && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-charcoal">
                            {SUPPLY_STATUS_LABELS[group.supply_request.status]}
                          </p>
                          {group.supply_request.logistics && (
                            <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-ink-soft">
                              {SUPPLY_METHOD_LABELS[group.supply_request.logistics.method] ??
                                group.supply_request.logistics.method}
                              {" → "}
                              {group.supply_request.logistics.amg_location_name}
                              <br />
                              Plan{" "}
                              {new Date(
                                group.supply_request.logistics.planned_dispatch_at,
                              ).toLocaleString()}
                            </p>
                          )}
                          {group.supply_request.dispatch && (
                            <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-charcoal">
                              {SUPPLY_VEHICLE_LABELS[group.supply_request.dispatch.vehicle_type]}{" "}
                              {group.supply_request.dispatch.vehicle_plate}
                              <br />
                              {group.supply_request.dispatch.driver_name} ·{" "}
                              {group.supply_request.dispatch.driver_phone}
                            </p>
                          )}
                          {group.supply_request.status === "dispatched" && (
                            <button
                              type="button"
                              disabled={busy === `fulfill-${group.supply_request.id}`}
                              onClick={() =>
                                void certifyFulfilled(group.supply_request!, group.supplier_name)
                              }
                              className="mt-2 bg-forest px-3 py-1.5 text-xs font-semibold text-sand-light disabled:opacity-50"
                            >
                              Certify fulfilled (inspected)
                            </button>
                          )}
                        </div>
                      )}
                      {group.supplier_id && !group.supply_request && openForSourcing && (
                        <button
                          type="button"
                          onClick={() => void openCompare(order)}
                          className="border border-ember px-3 py-2 text-xs font-semibold text-ember hover:bg-ember/10"
                        >
                          Analyse vs other suppliers
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {canConfirmBuyer &&
                  order.status !== "confirmed" &&
                  order.status !== "out_for_delivery" &&
                  order.status !== "delivered" && (
                    <button
                      type="button"
                      disabled={busy === `confirm-${order.id}`}
                      onClick={() => void confirmBuyer(order)}
                      className="border border-ember px-3 py-2 text-xs font-semibold text-ember hover:bg-ember/10 disabled:opacity-50"
                    >
                      Confirm order to buyer
                    </button>
                  )}
                {order.status === "confirmed" && (
                  <>
                    <select
                      value={riderChoice[order.id] ?? ""}
                      onChange={(e) =>
                        setRiderChoice((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      className="amg-select border border-line bg-white px-2 py-2 text-xs"
                    >
                      <option value="">Choose rider…</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {RIDER_VEHICLE_LABELS[r.vehicle] ?? r.vehicle}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy === `dispatch-${order.id}` || !riderChoice[order.id]}
                      onClick={() => void dispatch(order)}
                      className="bg-forest px-3 py-2 text-xs font-semibold text-sand-light disabled:opacity-50"
                    >
                      Dispatch with rider
                    </button>
                  </>
                )}
                <select
                  value={order.status}
                  onChange={(e) =>
                    void setStatus(order.id, e.target.value as OrderStatus)
                  }
                  className="amg-select border border-line bg-white px-2 py-1 text-xs"
                >
                  {(
                    [
                      "pending",
                      "awaiting_supplier",
                      "supplier_confirmed",
                      "confirmed",
                      "out_for_delivery",
                      "delivered",
                      "cancelled",
                    ] as OrderStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
      {orders.length === 0 && page === 0 && (
        <p className="mt-8 text-sm text-ink-soft">No orders yet.</p>
      )}
      <Pagination
        page={page}
        pageSize={ORDERS_PAGE_SIZE}
        count={totalOrders}
        onPageChange={setPage}
      />

      <SupplierCompareDialog
        open={Boolean(compareOrder && selection)}
        onClose={() => {
          setCompareOrderId(null);
          setSelection(null);
        }}
        orderLabel={
          compareOrder
            ? `${compareOrder.customer_name} · ${compareOrder.id.slice(0, 12)}`
            : "this order"
        }
        scorecards={selection?.scorecards ?? []}
        rationale={
          aiLoading
            ? "Scoring suppliers and refining the AI recommendation…"
            : selection?.rationale ?? ""
        }
        selectedId={selectedSupplierId}
        onSelect={setSelectedSupplierId}
        onConfirm={() => void confirmSupplierOrder()}
        busy={busy?.startsWith("fulfill-") ?? false}
      />
    </div>
  );
}
