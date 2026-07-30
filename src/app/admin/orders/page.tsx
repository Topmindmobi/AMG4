"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKes, ORDER_STATUS_LABELS, SUPPLY_STATUS_LABELS } from "@/lib/format";
import { groupOrderBySupplier } from "@/lib/orders";
import { notifyOrderSms } from "@/lib/sms/notify-client";
import { isDemoMode } from "@/lib/supabase/config";
import {
  confirmOrderToBuyer,
  dispatchDemoOrder,
  getDemoOrders,
  getDemoSupplyRequests,
  requestSupplyFromSupplier,
  updateDemoOrderStatus,
} from "@/lib/store/demo-store";
import type { Order, OrderStatus, SupplyRequest } from "@/lib/types";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplyByOrder, setSupplyByOrder] = useState<Record<string, SupplyRequest[]>>(
    {},
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    if (isDemoMode()) {
      const list = getDemoOrders();
      setOrders(list);
      const map: Record<string, SupplyRequest[]> = {};
      for (const o of list) {
        map[o.id] = getDemoSupplyRequests({ orderId: o.id });
      }
      setSupplyByOrder(map);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function orderFromSupplier(orderId: string, supplierId: string) {
    setBusy(`${orderId}-${supplierId}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        requestSupplyFromSupplier(orderId, supplierId);
        setMessage("Supplier notified. They will see a supply request in their portal.");
        load();
        return;
      }
      throw new Error("Supplier workflow requires demo mode or Supabase RPCs.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmBuyer(orderId: string) {
    setBusy(`confirm-${orderId}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        const order = confirmOrderToBuyer(orderId);
        await notifyOrderSms({
          orderId: order.id,
          phone: order.phone,
          event: "confirmed",
        });
        setMessage("Buyer notified — order confirmed.");
        load();
        return;
      }

      const existing = orders.find((o) => o.id === orderId);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          buyer_notified_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;

      if (existing?.phone) {
        await notifyOrderSms({
          orderId,
          phone: existing.phone,
          event: "confirmed",
        });
      }
      setMessage("Buyer notified — order confirmed.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function dispatch(orderId: string) {
    setBusy(`dispatch-${orderId}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        const order = dispatchDemoOrder(orderId);
        if (order?.phone) {
          await notifyOrderSms({
            orderId: order.id,
            phone: order.phone,
            event: "dispatched",
          });
        }
        setMessage("Order dispatched — out for delivery.");
        load();
        return;
      }

      const existing = orders.find((o) => o.id === orderId);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: "out_for_delivery" })
        .eq("id", orderId);
      if (error) throw error;

      if (existing?.phone) {
        await notifyOrderSms({
          orderId,
          phone: existing.phone,
          event: "dispatched",
        });
      }
      setMessage("Order dispatched — out for delivery.");
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

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const patch: { status: OrderStatus; buyer_notified_at?: string } = { status };
    if (status === "confirmed") {
      patch.buyer_notified_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Orders</h1>
      <p className="mt-2 text-sm text-sand/55">
        Forward items to suppliers → wait for their confirm → confirm to buyer → dispatch.
      </p>
      {message && (
        <p className="mt-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-sand">
          {message}
        </p>
      )}
      <ul className="mt-8 space-y-6">
        {orders.map((order) => {
          const groups = groupOrderBySupplier(order, supplyByOrder[order.id] || []);
          const assigned = groups.filter((g) => g.supplier_id);
          const allConfirmed =
            assigned.length > 0 &&
            assigned.every((g) => g.supply_request?.status === "confirmed");
          const canConfirmBuyer =
            order.status === "supplier_confirmed" ||
            (order.status === "awaiting_supplier" && allConfirmed) ||
            (assigned.length === 0 &&
              (order.status === "pending" || order.status === "awaiting_supplier"));

          return (
            <li key={order.id} className="border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/order/${order.id}`} className="font-medium hover:text-ember">
                    {order.customer_name}
                  </Link>
                  <p className="mt-1 text-xs text-sand/50">
                    {order.phone} · {order.town} · {order.payment_method.toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs text-sand/40">
                    {order.id} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ember">
                    {formatKes(Number(order.total_kes))}
                  </p>
                  <p className="mt-1 text-xs text-sand/45">
                    {ORDER_STATUS_LABELS[order.status]}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.supplier_id || "unassigned"}
                    className="border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {group.supplier_name}
                          <span className="ml-2 text-xs font-normal text-sand/45">
                            (admin only — hidden from shoppers)
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-sand/55">
                          {group.items
                            .map((i) => `${i.qty}× ${i.name_snapshot}`)
                            .join(" · ")}
                        </p>
                        <p className="mt-1 text-xs text-ember">
                          Subtotal {formatKes(group.total_kes)}
                        </p>
                      </div>
                      {group.supplier_id && (
                        <div className="text-right">
                          {group.supply_request ? (
                            <p className="text-xs text-sand/60">
                              {SUPPLY_STATUS_LABELS[group.supply_request.status]}
                            </p>
                          ) : (
                            <button
                              type="button"
                              disabled={busy === `${order.id}-${group.supplier_id}`}
                              onClick={() =>
                                void orderFromSupplier(order.id, group.supplier_id!)
                              }
                              className="bg-ember px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Order from {group.supplier_name}
                            </button>
                          )}
                        </div>
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
                      onClick={() => void confirmBuyer(order.id)}
                      className="border border-ember px-3 py-2 text-xs font-semibold text-ember hover:bg-ember/10 disabled:opacity-50"
                    >
                      Confirm order to buyer
                    </button>
                  )}
                {order.status === "confirmed" && (
                  <button
                    type="button"
                    disabled={busy === `dispatch-${order.id}`}
                    onClick={() => void dispatch(order.id)}
                    className="bg-forest px-3 py-2 text-xs font-semibold text-sand-light disabled:opacity-50"
                  >
                    Dispatch (AMG delivery)
                  </button>
                )}
                <select
                  value={order.status}
                  onChange={(e) =>
                    void setStatus(order.id, e.target.value as OrderStatus)
                  }
                  className="border border-white/15 bg-forest-deep px-2 py-1 text-xs"
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
      {orders.length === 0 && (
        <p className="mt-8 text-sm text-sand/50">No orders yet.</p>
      )}
    </div>
  );
}
