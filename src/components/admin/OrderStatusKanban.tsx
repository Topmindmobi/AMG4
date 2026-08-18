"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { OrderRatingForm } from "@/components/admin/OrderRatingForm";
import { RiderDeliveryTracker } from "@/components/orders/RiderDeliveryTracker";
import {
  formatKes,
  ORDER_KANBAN_COLUMNS,
  ORDER_STATUS_LABELS,
  RATING_SUBJECT_LABELS,
  RIDER_VEHICLE_LABELS,
  SUPPLY_STATUS_LABELS,
} from "@/lib/format";
import { orderRatingSummary } from "@/lib/ratings";
import type {
  Order,
  OrderStatus,
  RatingScores,
  RatingSubject,
  Rider,
  ServiceRating,
  Supplier,
  SupplyRequest,
} from "@/lib/types";

type KanbanColumn = (typeof ORDER_KANBAN_COLUMNS)[number]["id"];

const COLUMN_ATTR = "data-kanban-status";

/** Pointer Events unify mouse/touch/pen — the native HTML5 Drag and Drop API
 * this replaced never fires from touch input at all, which is why dragging
 * silently did nothing on the Android app. */
function columnUnderPoint(x: number, y: number): KanbanColumn | null {
  const el = document.elementFromPoint(x, y)?.closest(`[${COLUMN_ATTR}]`);
  return (el?.getAttribute(COLUMN_ATTR) as KanbanColumn | null) ?? null;
}

function columnOf(status: OrderStatus): KanbanColumn | null {
  if (status === "cancelled") return null;
  return status as KanbanColumn;
}

export function OrderStatusKanban({
  orders,
  supplyByOrder,
  suppliers,
  riders,
  ratings,
  onRequestSupplier,
  onRecordSupplierResponse,
  onConfirmBuyer,
  onDispatch,
  onDeliver,
  onSaveRatings,
}: {
  orders: Order[];
  supplyByOrder: Record<string, SupplyRequest[]>;
  suppliers: Supplier[];
  riders: Rider[];
  ratings: ServiceRating[];
  onRequestSupplier: (orderId: string, supplierId: string) => void | Promise<void>;
  onRecordSupplierResponse: (orderId: string) => void | Promise<void>;
  onConfirmBuyer: (orderId: string) => void | Promise<void>;
  onDispatch: (orderId: string, riderId: string) => void | Promise<void>;
  onDeliver: (orderId: string) => void | Promise<void>;
  onSaveRatings: (
    orderId: string,
    subjects: {
      subject: RatingSubject;
      scores: RatingScores;
      notes: string | null;
    }[],
  ) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<"all" | KanbanColumn>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanColumn | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [pickSupplierFor, setPickSupplierFor] = useState<string | null>(null);
  const [pickRiderFor, setPickRiderFor] = useState<string | null>(null);
  const [rateOrderId, setRateOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(
      ORDER_KANBAN_COLUMNS.map((c) => [c.id, [] as Order[]]),
    ) as Record<KanbanColumn, Order[]>;
    for (const o of orders) {
      const col = columnOf(o.status);
      if (col) map[col].push(o);
    }
    return map;
  }, [orders]);

  const ratingsByOrder = useMemo(() => {
    const map: Record<string, ServiceRating[]> = {};
    for (const r of ratings) {
      (map[r.order_id] ??= []).push(r);
    }
    return map;
  }, [ratings]);

  const dragging = orders.find((o) => o.id === draggingId) ?? null;
  const pickSupplierOrder = orders.find((o) => o.id === pickSupplierFor) ?? null;
  const pickRiderOrder = orders.find((o) => o.id === pickRiderFor) ?? null;
  const rateOrder = orders.find((o) => o.id === rateOrderId) ?? null;

  function canDrop(from: OrderStatus, to: KanbanColumn): boolean {
    if (from === "pending" && to === "awaiting_supplier") return true;
    if (from === "awaiting_supplier" && to === "supplier_confirmed") return true;
    if (from === "supplier_confirmed" && to === "confirmed") return true;
    if (from === "confirmed" && to === "out_for_delivery") return true;
    if (from === "out_for_delivery" && to === "delivered") return true;
    return false;
  }

  async function applyMove(orderId: string, to: KanbanColumn) {
    setError(null);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    try {
      if (order.status === "pending" && to === "awaiting_supplier") {
        setPickSupplierFor(orderId);
        return;
      }
      if (order.status === "awaiting_supplier" && to === "supplier_confirmed") {
        await onRecordSupplierResponse(orderId);
        return;
      }
      if (order.status === "supplier_confirmed" && to === "confirmed") {
        await onConfirmBuyer(orderId);
        return;
      }
      if (order.status === "confirmed" && to === "out_for_delivery") {
        setPickRiderFor(orderId);
        return;
      }
      if (order.status === "out_for_delivery" && to === "delivered") {
        await onDeliver(orderId);
        setRateOrderId(orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }

  function onHandlePointerDown(e: PointerEvent<HTMLButtonElement>, orderId: string) {
    if (e.button != null && e.button !== 0) return; // left click / primary touch only
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
    const from = orders.find((o) => o.id === draggingId)?.status;
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
      ? ORDER_KANBAN_COLUMNS
      : ORDER_KANBAN_COLUMNS.filter((c) => c.id === tab);

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
          All ({orders.filter((o) => o.status !== "cancelled").length})
        </button>
        {ORDER_KANBAN_COLUMNS.map((c) => (
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
        className={`mt-6 grid gap-4 ${
          tab === "all"
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            : "grid-cols-1"
        }`}
      >
        {visibleColumns.map((col) => {
          const list = byColumn[col.id];
          const highlight =
            dropTarget === col.id &&
            dragging &&
            canDrop(dragging.status, col.id);
          return (
            <section
              key={col.id}
              {...{ [COLUMN_ATTR]: col.id }}
              className={`min-h-[180px] border bg-white p-3 transition ${
                highlight
                  ? "border-ember ring-2 ring-ember/30"
                  : "border-line"
              }`}
            >
              <header className="mb-3 border-b border-line pb-2">
                <h2 className="font-display text-lg text-charcoal">{col.title}</h2>
                <p className="text-xs text-ink-soft">{col.hint}</p>
                <p className="mt-1 text-xs font-semibold text-forest">
                  {list.length} order{list.length === 1 ? "" : "s"}
                </p>
              </header>

              <ul className="space-y-2">
                {list.map((order) => {
                  const srs = supplyByOrder[order.id] ?? [];
                  const summary = orderRatingSummary(
                    ratingsByOrder[order.id] ?? [],
                  );
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
                          aria-label="Drag to change status"
                          onPointerDown={(e) => onHandlePointerDown(e, order.id)}
                          onPointerMove={onHandlePointerMove}
                          onPointerUp={(e) => endDrag(e, true)}
                          onPointerCancel={(e) => endDrag(e, false)}
                          style={{ touchAction: "none" }}
                          className="cursor-grab select-none px-1 text-ink-soft active:cursor-grabbing"
                        >
                          ⋮⋮
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/admin/orders`}
                              className="text-sm font-semibold text-charcoal hover:text-ember"
                            >
                              {order.customer_name}
                            </Link>
                            <span className="text-xs text-ember">
                              {formatKes(Number(order.total_kes))}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {order.town} · {ORDER_STATUS_LABELS[order.status]}
                          </p>
                          <p className="mt-1 text-xs text-charcoal/80">
                            {(order.items ?? [])
                              .slice(0, 3)
                              .map((i) => `${i.qty}× ${i.name_snapshot}`)
                              .join(" · ")}
                            {(order.items?.length ?? 0) > 3 ? "…" : ""}
                          </p>
                          {srs.length > 0 && (
                            <p className="mt-1 text-[13px] text-ink-soft">
                              {srs
                                .map(
                                  (r) =>
                                    `${r.supplier_name}: ${SUPPLY_STATUS_LABELS[r.status] ?? r.status}`,
                                )
                                .join(" · ")}
                            </p>
                          )}
                          {(order.rider_id || order.rider_name_snapshot) && (
                            <RiderDeliveryTracker order={order} audience="admin" />
                          )}
                          {summary.count > 0 && (
                            <p className="mt-1 text-[13px] text-forest">
                              Rated {summary.average}/5 ·{" "}
                              {Object.entries(summary.bySubject)
                                .map(
                                  ([k, v]) =>
                                    `${RATING_SUBJECT_LABELS[k] ?? k} ${v}`,
                                )
                                .join(" · ")}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {order.status === "pending" && (
                              <ActionBtn
                                label="Request supplier"
                                onClick={() => setPickSupplierFor(order.id)}
                              />
                            )}
                            {order.status === "awaiting_supplier" && (
                              <ActionBtn
                                label="Record response"
                                onClick={() =>
                                  void applyMove(order.id, "supplier_confirmed")
                                }
                              />
                            )}
                            {order.status === "supplier_confirmed" && (
                              <ActionBtn
                                label="Confirm to buyer"
                                onClick={() =>
                                  void applyMove(order.id, "confirmed")
                                }
                              />
                            )}
                            {order.status === "confirmed" && (
                              <ActionBtn
                                label="Dispatch"
                                onClick={() => setPickRiderFor(order.id)}
                              />
                            )}
                            {order.status === "out_for_delivery" && (
                              <ActionBtn
                                label="Mark delivered"
                                onClick={() =>
                                  void applyMove(order.id, "delivered")
                                }
                              />
                            )}
                            {(order.status === "delivered" ||
                              summary.count > 0) && (
                              <ActionBtn
                                label={summary.count ? "Edit ratings" : "Rate"}
                                onClick={() => setRateOrderId(order.id)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="border border-dashed border-line px-3 py-6 text-center text-xs text-ink-soft">
                    {highlight ? "Drop here" : "No orders"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {pickSupplierOrder && (
        <PickModal
          title="Send supplier request"
          description={`Choose a supplier for ${pickSupplierOrder.customer_name}'s order. This moves it to Supplier Request.`}
          onClose={() => setPickSupplierFor(null)}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const supplierId = String(fd.get("supplierId") || "");
              if (!supplierId) return;
              void Promise.resolve(onRequestSupplier(pickSupplierOrder.id, supplierId))
                .then(() => setPickSupplierFor(null))
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Request failed"),
                );
            }}
          >
            <label className="block text-xs uppercase tracking-wide text-ink-soft">
              Supplier
              <select
                name="supplierId"
                required
                className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.town ? ` (${s.town})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <ModalActions onCancel={() => setPickSupplierFor(null)} submit="Send request" />
          </form>
        </PickModal>
      )}

      {pickRiderOrder && (
        <PickModal
          title="Dispatch order"
          description={`Assign a rider for delivery to ${pickRiderOrder.town}.`}
          onClose={() => setPickRiderFor(null)}
        >
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const riderId = String(fd.get("riderId") || "");
              if (!riderId) return;
              void Promise.resolve(onDispatch(pickRiderOrder.id, riderId))
                .then(() => setPickRiderFor(null))
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Dispatch failed"),
                );
            }}
          >
            <label className="block text-xs uppercase tracking-wide text-ink-soft">
              Rider
              <select
                name="riderId"
                required
                className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {(riders.filter((r) => !r.town || r.town === pickRiderOrder.town)
                  .length
                  ? riders.filter(
                      (r) => !r.town || r.town === pickRiderOrder.town,
                    )
                  : riders
                ).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.town ? ` · ${r.town}` : ""}
                    {r.vehicle ? ` · ${RIDER_VEHICLE_LABELS[r.vehicle] ?? r.vehicle}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <ModalActions onCancel={() => setPickRiderFor(null)} submit="Dispatch" />
          </form>
        </PickModal>
      )}

      {rateOrder && (
        <OrderRatingForm
          order={rateOrder}
          supplyRequests={supplyByOrder[rateOrder.id] ?? []}
          existing={ratingsByOrder[rateOrder.id] ?? []}
          onClose={() => setRateOrderId(null)}
          onSave={(subjects) => {
            void Promise.resolve(onSaveRatings(rateOrder.id, subjects)).then(() =>
              setRateOrderId(null),
            );
          }}
        />
      )}
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-forest px-2 py-1 text-[13px] font-semibold text-forest hover:bg-forest/5"
    >
      {label}
    </button>
  );
}

function PickModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-line bg-white p-5">
        <h2 className="font-display text-xl text-charcoal">{title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
        <div className="mt-4">{children}</div>
        <button
          type="button"
          className="sr-only"
          onClick={onClose}
          aria-label="Close"
        />
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  submit,
}: {
  onCancel: () => void;
  submit: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        className="bg-ember px-4 py-2.5 text-sm font-semibold text-white"
      >
        {submit}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft"
      >
        Cancel
      </button>
    </div>
  );
}
