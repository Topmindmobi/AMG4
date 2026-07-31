"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, type DragEvent } from "react";
import { RiderPaymentPanel } from "@/components/rider/RiderPaymentPanel";
import {
  DELIVERY_METHOD_LABELS,
  formatKes,
  RIDER_DELIVERY_COLUMNS,
} from "@/lib/format";
import { normalizeRiderDeliveryStatus } from "@/lib/store/demo-store";
import type { Order, RiderDeliveryStatus } from "@/lib/types";

function allowDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
}

const FORWARD: Partial<Record<RiderDeliveryStatus, RiderDeliveryStatus[]>> = {
  assigned: ["collected", "failed"],
  collected: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: ["paid", "failed"],
  paid: [],
  failed: ["assigned", "collected"],
};

export function RiderDeliveryKanban({
  orders,
  busy,
  onAdvance,
  onCollectCash,
  onSendMpesa,
}: {
  orders: Order[];
  busy: string | null;
  onAdvance: (
    orderId: string,
    to: RiderDeliveryStatus,
    extras?: { failReason?: string },
  ) => void | Promise<void>;
  onCollectCash: (order: Order) => void;
  onSendMpesa: (order: Order, phone: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"all" | RiderDeliveryStatus>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<RiderDeliveryStatus | null>(null);
  const [payForId, setPayForId] = useState<string | null>(null);
  const [failForId, setFailForId] = useState<string | null>(null);
  const [failReason, setFailReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enriched = useMemo(
    () =>
      orders.map((o) => ({
        ...o,
        rider_delivery_status: normalizeRiderDeliveryStatus(o),
      })),
    [orders],
  );

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(
      RIDER_DELIVERY_COLUMNS.map((c) => [c.id, [] as Order[]]),
    ) as Record<RiderDeliveryStatus, Order[]>;
    for (const o of enriched) {
      const col = o.rider_delivery_status ?? "assigned";
      map[col].push(o);
    }
    return map;
  }, [enriched]);

  const dragging = enriched.find((o) => o.id === draggingId) ?? null;
  const payOrder = enriched.find((o) => o.id === payForId) ?? null;
  const failOrder = enriched.find((o) => o.id === failForId) ?? null;

  function canDrop(from: RiderDeliveryStatus, to: RiderDeliveryStatus): boolean {
    if (from === to) return false;
    return (FORWARD[from] ?? []).includes(to);
  }

  async function applyMove(orderId: string, to: RiderDeliveryStatus) {
    setError(null);
    const order = enriched.find((o) => o.id === orderId);
    if (!order) return;
    const from = normalizeRiderDeliveryStatus(order);

    if (to === "paid" && !order.paid) {
      setPayForId(orderId);
      return;
    }
    if (to === "failed") {
      setFailForId(orderId);
      setFailReason("");
      return;
    }

    try {
      await onAdvance(orderId, to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move order");
    }
  }

  function onDropColumn(e: DragEvent, to: RiderDeliveryStatus) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    const from = enriched.find((o) => o.id === id)?.rider_delivery_status;
    setDraggingId(null);
    setDropTarget(null);
    if (!id || !from || !canDrop(from, to)) return;
    void applyMove(id, to);
  }

  const visibleColumns =
    tab === "all"
      ? RIDER_DELIVERY_COLUMNS
      : RIDER_DELIVERY_COLUMNS.filter((c) => c.id === tab);

  return (
    <div>
      {error && (
        <p className="mb-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-sand">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`border px-3 py-1.5 text-xs font-medium ${
            tab === "all"
              ? "border-ember text-ember"
              : "border-white/20 text-sand/55 hover:text-sand"
          }`}
        >
          All ({enriched.length})
        </button>
        {RIDER_DELIVERY_COLUMNS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.id)}
            className={`border px-3 py-1.5 text-xs font-medium ${
              tab === c.id
                ? "border-ember text-ember"
                : "border-white/20 text-sand/55 hover:text-sand"
            }`}
          >
            {c.title} ({byColumn[c.id].length})
          </button>
        ))}
      </div>

      <div
        className={`mt-6 grid gap-3 ${
          tab === "all"
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            : "grid-cols-1"
        }`}
      >
        {visibleColumns.map((col) => {
          const list = byColumn[col.id];
          const highlight =
            dropTarget === col.id &&
            dragging &&
            canDrop(normalizeRiderDeliveryStatus(dragging), col.id);

          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                if (!dragging) return;
                if (!canDrop(normalizeRiderDeliveryStatus(dragging), col.id)) return;
                allowDrop(e);
                setDropTarget(col.id);
              }}
              onDragLeave={() => {
                if (dropTarget === col.id) setDropTarget(null);
              }}
              onDrop={(e) => onDropColumn(e, col.id)}
              className={`min-h-[160px] border p-3 transition ${
                highlight
                  ? "border-ember ring-2 ring-ember/40 bg-ember/5"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <header className="mb-3 border-b border-white/10 pb-2">
                <h2 className="font-display text-lg text-sand">{col.title}</h2>
                <p className="text-[11px] text-sand/45">{col.hint}</p>
                <p className="mt-1 text-xs font-semibold text-ember">
                  {list.length}
                </p>
              </header>

              <ul className="space-y-2">
                {list.map((order) => {
                  const stage = normalizeRiderDeliveryStatus(order);
                  return (
                    <li
                      key={order.id}
                      className={`border border-white/10 bg-forest-deep/60 px-3 py-3 ${
                        draggingId === order.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          draggable
                          aria-label="Drag to change stage"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", order.id);
                            e.dataTransfer.effectAllowed = "move";
                            requestAnimationFrame(() => setDraggingId(order.id));
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTarget(null);
                          }}
                          className="cursor-grab px-1 text-sand/40 active:cursor-grabbing"
                        >
                          ⋮⋮
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={`/order/${order.id}`}
                              className="text-sm font-semibold text-sand hover:text-ember"
                            >
                              {order.customer_name}
                            </Link>
                            <span className="text-xs font-semibold text-ember">
                              {formatKes(Number(order.total_kes))}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-sand/50">
                            {order.phone} · {order.town}
                          </p>
                          <p className="mt-0.5 text-[11px] text-sand/45">
                            {DELIVERY_METHOD_LABELS[order.delivery_method]}
                            {order.delivery_method === "dropoff" &&
                            order.dropoff_point_name
                              ? ` — ${order.dropoff_point_name}`
                              : ` — ${order.address}`}
                          </p>
                          <p className="mt-1 text-[11px]">
                            <span
                              className={
                                order.paid ? "text-sand" : "font-semibold text-ember"
                              }
                            >
                              {order.paid ? "Paid" : "Unpaid"}
                            </span>
                          </p>
                          {stage === "failed" && order.rider_fail_reason && (
                            <p className="mt-1 text-[11px] text-ember">
                              {order.rider_fail_reason}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(FORWARD[stage] ?? []).map((next) => (
                              <button
                                key={next}
                                type="button"
                                disabled={Boolean(busy)}
                                onClick={() => void applyMove(order.id, next)}
                                className="border border-white/15 px-2 py-1 text-[10px] font-semibold text-sand/70 hover:border-ember hover:text-ember disabled:opacity-40"
                              >
                                →{" "}
                                {RIDER_DELIVERY_COLUMNS.find((c) => c.id === next)
                                  ?.title ?? next}
                              </button>
                            ))}
                          </div>

                          {(stage === "delivered" || stage === "in_transit") &&
                            !order.paid && (
                              <button
                                type="button"
                                className="mt-2 text-[11px] font-semibold text-ember underline"
                                onClick={() => setPayForId(order.id)}
                              >
                                Collect payment (M-Pesa / cash)
                              </button>
                            )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-sand/40">
                    {highlight ? "Drop here" : "Empty"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {payOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 p-4 sm:items-center">
          <div className="w-full max-w-md border border-white/15 bg-forest-deep p-4 text-sand">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl">Collect payment</h3>
                <p className="mt-1 text-sm text-sand/60">
                  {payOrder.customer_name} · {formatKes(Number(payOrder.total_kes))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayForId(null)}
                className="text-sm text-sand/50 hover:text-sand"
              >
                Close
              </button>
            </div>
            <RiderPaymentPanel
              order={payOrder}
              disabled={Boolean(busy)}
              cashBusy={busy === `cash-${payOrder.id}`}
              mpesaBusy={busy === `mpesa-${payOrder.id}`}
              deliverBusy={busy === `deliver-${payOrder.id}`}
              onCollectCash={() => onCollectCash(payOrder)}
              onSendMpesa={(phone) => onSendMpesa(payOrder, phone)}
              onDeliver={() => {
                void Promise.resolve(onAdvance(payOrder.id, "paid")).then(() =>
                  setPayForId(null),
                );
              }}
            />
            {payOrder.paid && (
              <button
                type="button"
                className="mt-3 w-full bg-ember px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => {
                  void Promise.resolve(onAdvance(payOrder.id, "paid")).then(() =>
                    setPayForId(null),
                  );
                }}
              >
                Move to Paid column
              </button>
            )}
          </div>
        </div>
      )}

      {failOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 p-4 sm:items-center">
          <form
            className="w-full max-w-md border border-white/15 bg-forest-deep p-4 text-sand"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void Promise.resolve(
                onAdvance(failOrder.id, "failed", {
                  failReason: failReason || "Customer unavailable",
                }),
              ).then(() => {
                setFailForId(null);
                setFailReason("");
              });
            }}
          >
            <h3 className="font-display text-xl">Fail delivery</h3>
            <p className="mt-1 text-sm text-sand/60">
              Why couldn&apos;t you complete {failOrder.customer_name}&apos;s order?
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-sand/50">
              Reason
              <input
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Customer not reachable, wrong address…"
                className="mt-1 w-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-sand"
                required
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                className="bg-ember px-4 py-2.5 text-sm font-semibold text-white"
              >
                Mark failed
              </button>
              <button
                type="button"
                onClick={() => setFailForId(null)}
                className="border border-white/20 px-4 py-2.5 text-sm text-sand/70"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
