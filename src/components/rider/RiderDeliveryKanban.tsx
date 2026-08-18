"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState, type PointerEvent } from "react";
import { RiderPaymentPanel } from "@/components/rider/RiderPaymentPanel";
import {
  DELIVERY_METHOD_LABELS,
  formatKes,
  RIDER_DELIVERY_COLUMNS,
} from "@/lib/format";
import { normalizeRiderDeliveryStatus } from "@/lib/store/demo-store";
import type { Order, RiderDeliveryStatus } from "@/lib/types";

const COLUMN_ATTR = "data-kanban-status";

/** Pointer Events unify mouse/touch/pen — the native HTML5 Drag and Drop API
 * this replaced never fires from touch input at all, which is why dragging
 * silently did nothing on the Android app. */
function columnUnderPoint(x: number, y: number): RiderDeliveryStatus | null {
  const el = document.elementFromPoint(x, y)?.closest(`[${COLUMN_ATTR}]`);
  return (el?.getAttribute(COLUMN_ATTR) as RiderDeliveryStatus | null) ?? null;
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
  const activePointerId = useRef<number | null>(null);
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

  function onHandlePointerDown(e: PointerEvent<HTMLButtonElement>, orderId: string) {
    if (e.button != null && e.button !== 0) return; // left click / primary touch only
    // Capture is best-effort: it keeps move/up events targeting this handle
    // even once the finger leaves it, but a handful of environments (older
    // WebViews, or a pointerId already released) throw here — that must not
    // block the drag from starting.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* fall through — drag still tracks via the move/up handlers below */
    }
    activePointerId.current = e.pointerId;
    setDraggingId(orderId);
    setDropTarget(null);
  }

  function onHandlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (activePointerId.current !== e.pointerId || !draggingId) return;
    const from = enriched.find((o) => o.id === draggingId)?.rider_delivery_status;
    const over = columnUnderPoint(e.clientX, e.clientY);
    setDropTarget(over && from && canDrop(from, over) ? over : null);
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (activePointerId.current !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* already released / never captured — nothing to clean up */
    }
    activePointerId.current = null;
    const id = draggingId;
    const to = dropTarget;
    setDraggingId(null);
    setDropTarget(null);
    if (commit && id && to) void applyMove(id, to);
  }

  const visibleColumns =
    tab === "all"
      ? RIDER_DELIVERY_COLUMNS
      : RIDER_DELIVERY_COLUMNS.filter((c) => c.id === tab);

  return (
    <div>
      {error && (
        <p className="mb-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
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
              : "border-line text-ink-soft hover:text-charcoal"
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
                : "border-line text-ink-soft hover:text-charcoal"
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
              {...{ [COLUMN_ATTR]: col.id }}
              className={`min-h-[160px] border bg-white p-3 transition ${
                highlight ? "border-ember ring-2 ring-ember/40 bg-ember/5" : "border-line"
              }`}
            >
              <header className="mb-3 border-b border-line pb-2">
                <h2 className="font-display text-lg text-charcoal">{col.title}</h2>
                <p className="text-[13px] text-ink-soft">{col.hint}</p>
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
                      className={`border border-line bg-sand px-3 py-3 ${
                        draggingId === order.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          aria-label="Drag to change stage"
                          onPointerDown={(e) => onHandlePointerDown(e, order.id)}
                          onPointerMove={onHandlePointerMove}
                          onPointerUp={(e) => endDrag(e, true)}
                          onPointerCancel={(e) => endDrag(e, false)}
                          style={{ touchAction: "none" }}
                          className="cursor-grab select-none px-1 py-1 text-ink-soft active:cursor-grabbing"
                        >
                          ⋮⋮
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={`/order/${order.id}`}
                              className="text-sm font-semibold text-charcoal hover:text-ember"
                            >
                              {order.customer_name}
                            </Link>
                            <span className="text-xs font-semibold text-ember">
                              {formatKes(Number(order.total_kes))}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-ink-soft">
                            {order.phone} · {order.town}
                          </p>
                          <p className="mt-0.5 text-[13px] text-ink-soft">
                            {DELIVERY_METHOD_LABELS[order.delivery_method]}
                            {order.delivery_method === "dropoff" &&
                            order.dropoff_point_name
                              ? ` — ${order.dropoff_point_name}`
                              : ` — ${order.address}`}
                          </p>
                          <p className="mt-1 text-[13px]">
                            <span
                              className={
                                order.paid ? "text-charcoal" : "font-semibold text-ember"
                              }
                            >
                              {order.paid ? "Paid" : "Unpaid"}
                            </span>
                          </p>
                          {stage === "failed" && order.rider_fail_reason && (
                            <p className="mt-1 text-[13px] text-ember">
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
                                className="border border-line px-2 py-1 text-[12px] font-semibold text-ink-soft hover:border-ember hover:text-ember disabled:opacity-40"
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
                                className="mt-2 text-[13px] font-semibold text-ember underline"
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
                  <li className="border border-dashed border-line px-3 py-6 text-center text-[13px] text-ink-soft">
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-line bg-white p-4 text-charcoal">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl">Collect payment</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {payOrder.customer_name} · {formatKes(Number(payOrder.total_kes))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayForId(null)}
                className="text-sm text-ink-soft hover:text-charcoal"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-line bg-white p-4 text-charcoal"
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
            <p className="mt-1 text-sm text-ink-soft">
              Why couldn&apos;t you complete {failOrder.customer_name}&apos;s order?
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-ink-soft">
              Reason
              <input
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Customer not reachable, wrong address…"
                className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
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
                className="border border-line px-4 py-2.5 text-sm text-ink-soft"
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
