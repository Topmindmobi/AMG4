"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  formatKes,
  SUPPLY_METHOD_LABELS,
  SUPPLY_STATUS_LABELS,
  SUPPLY_VEHICLE_LABELS,
  TOWNS,
} from "@/lib/format";
import { getDemoDropoffPoints } from "@/lib/store/demo-store";
import type {
  DropoffPoint,
  SupplyDispatchDetails,
  SupplyLogisticsPlan,
  SupplyMethod,
  SupplyRequest,
  SupplyRequestStatus,
  SupplyVehicleType,
  Town,
} from "@/lib/types";

const COLUMNS: { id: SupplyRequestStatus; title: string; hint: string }[] = [
  { id: "pending", title: "New orders", hint: "Awaiting your confirm + logistics plan" },
  { id: "confirmed", title: "Confirmed", hint: "Plan filed — ready to dispatch to AMG" },
  { id: "dispatched", title: "Dispatched", hint: "In transit to AMG hub" },
  { id: "fulfilled", title: "Fulfilled", hint: "AMG inspected & certified" },
];

const TABS = [
  { id: "all", label: "All orders" },
  { id: "pending", label: "New orders" },
  { id: "confirmed", label: "Confirmed" },
  { id: "dispatched", label: "Dispatched" },
  { id: "fulfilled", label: "Fulfilled" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function allowDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
}

export function SupplyKanban({
  requests,
  onMove,
}: {
  requests: SupplyRequest[];
  onMove: (
    requestId: string,
    to: SupplyRequestStatus,
    extras?: { logistics?: SupplyLogisticsPlan; dispatch?: SupplyDispatchDetails },
  ) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SupplyRequestStatus | null>(null);
  const [logisticsForId, setLogisticsForId] = useState<string | null>(null);
  const [dispatchForId, setDispatchForId] = useState<string | null>(null);
  /** After saving logistics for a legacy confirmed card, continue into dispatch. */
  const [continueToDispatchId, setContinueToDispatchId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map: Record<SupplyRequestStatus, SupplyRequest[]> = {
      pending: [],
      confirmed: [],
      dispatched: [],
      fulfilled: [],
      rejected: [],
    };
    for (const r of requests) {
      if (map[r.status]) map[r.status].push(r);
      else map.pending.push(r);
    }
    return map;
  }, [requests]);

  const dragging = requests.find((r) => r.id === draggingId) ?? null;
  const logisticsRequest = requests.find((r) => r.id === logisticsForId) ?? null;
  const dispatchRequest = requests.find((r) => r.id === dispatchForId) ?? null;

  function canDrop(from: SupplyRequestStatus, to: SupplyRequestStatus): boolean {
    if (from === "pending" && to === "confirmed") return true;
    if (from === "confirmed" && to === "dispatched") return true;
    return false;
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers need a drag image / async setState after setData
    requestAnimationFrame(() => setDraggingId(id));
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function onDropColumn(e: DragEvent, to: SupplyRequestStatus) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    const fromStatus = requests.find((r) => r.id === id)?.status;
    setDraggingId(null);
    setDropTarget(null);
    if (!id || !fromStatus) return;
    if (!canDrop(fromStatus, to)) return;

    if (fromStatus === "pending" && to === "confirmed") {
      setContinueToDispatchId(null);
      setLogisticsForId(id);
      return;
    }
    if (fromStatus === "confirmed" && to === "dispatched") {
      const req = requests.find((r) => r.id === id);
      if (!req?.logistics) {
        // Legacy confirmed cards without a plan — collect logistics first, then dispatch
        setContinueToDispatchId(id);
        setLogisticsForId(id);
        return;
      }
      setDispatchForId(id);
      return;
    }
  }

  const visibleColumns =
    tab === "all" ? COLUMNS : COLUMNS.filter((c) => c.id === tab);

  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft">
        Drag a card by the grip handle onto the next column. New → Confirmed asks for a logistics
        plan; Confirmed → Dispatched asks for driver and vehicle details. Fulfilled is set by AMG
        only.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((t) => {
          const count =
            t.id === "all"
              ? requests.filter((r) => r.status !== "rejected").length
              : byColumn[t.id as SupplyRequestStatus]?.length ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.id
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-line bg-white text-ink-soft hover:border-forest/40 hover:text-charcoal"
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`mt-5 grid gap-4 ${
          tab === "all" ? "lg:grid-cols-4" : "grid-cols-1 max-w-xl"
        }`}
      >
        {visibleColumns.map((col) => {
          const accepts =
            dragging != null && canDrop(dragging.status, col.id) && dragging.status !== col.id;
          const highlighted = dropTarget === col.id && accepts;

          return (
            <section
              key={col.id}
              onDragEnter={(e) => {
                allowDrop(e);
                if (accepts) setDropTarget(col.id);
              }}
              onDragOver={(e) => {
                allowDrop(e);
                if (accepts) setDropTarget(col.id);
              }}
              onDragLeave={(e) => {
                const related = e.relatedTarget as Node | null;
                if (related && e.currentTarget.contains(related)) return;
                setDropTarget((prev) => (prev === col.id ? null : prev));
              }}
              onDrop={(e) => onDropColumn(e, col.id)}
              className={`flex min-h-[260px] flex-col rounded-lg border p-3 transition ${
                highlighted
                  ? "border-ember bg-ember/10 ring-2 ring-ember/30"
                  : accepts
                    ? "border-forest/40 bg-sand"
                    : "border-line bg-sand/60"
              }`}
            >
              <header className="mb-3 pointer-events-none">
                <h2 className="text-sm font-semibold text-charcoal">{col.title}</h2>
                <p className="mt-0.5 text-[11px] text-ink-soft">{col.hint}</p>
                <p className="mt-1 text-xs font-medium text-forest">
                  {byColumn[col.id].length} order{byColumn[col.id].length === 1 ? "" : "s"}
                </p>
              </header>

              <ul
                className="flex flex-1 flex-col gap-2"
                onDragOver={allowDrop}
                onDrop={(e) => onDropColumn(e, col.id)}
              >
                {byColumn[col.id].map((r) => {
                  const movable = r.status === "pending" || r.status === "confirmed";
                  return (
                    <li
                      key={r.id}
                      onDragOver={allowDrop}
                      onDrop={(e) => onDropColumn(e, col.id)}
                      className={`rounded-lg border border-line bg-white p-3 shadow-sm ${
                        draggingId === r.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {movable ? (
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => onDragStart(e, r.id)}
                            onDragEnd={onDragEnd}
                            aria-label="Drag to move order"
                            title="Drag to next column"
                            className="mt-0.5 cursor-grab touch-none select-none rounded border border-line bg-sand px-1.5 py-1 text-ink-soft active:cursor-grabbing hover:border-forest hover:text-charcoal"
                          >
                            <span aria-hidden className="block leading-none">
                              ⋮⋮
                            </span>
                          </button>
                        ) : (
                          <span className="mt-0.5 w-7" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/supplier/requests/${r.id}`}
                            className="text-sm font-semibold text-charcoal hover:text-ember"
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                          >
                            {r.id.slice(0, 12)}
                          </Link>
                          <p className="mt-1 text-[11px] text-ink-soft">
                            Order {r.order_id.slice(0, 12)} · Client town {r.customer_town}
                          </p>
                          <p className="mt-2 text-xs text-ink-soft">
                            {r.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-ember">
                            {formatKes(r.total_kes)}
                          </p>
                          {r.logistics ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                              {SUPPLY_METHOD_LABELS[r.logistics.method] ?? r.logistics.method}
                              {" → "}
                              {r.logistics.amg_location_name}
                              <br />
                              Plan{" "}
                              {new Date(r.logistics.planned_dispatch_at).toLocaleString()}
                            </p>
                          ) : r.status === "confirmed" ? (
                            <p className="mt-2 text-[11px] font-medium text-ember">
                              Logistics plan missing — drag to Dispatched to add it
                            </p>
                          ) : null}
                          {r.dispatch && (
                            <p className="mt-2 text-[11px] leading-relaxed text-charcoal">
                              {SUPPLY_VEHICLE_LABELS[r.dispatch.vehicle_type]} ·{" "}
                              {r.dispatch.vehicle_plate}
                              <br />
                              Driver {r.dispatch.driver_name} · {r.dispatch.driver_phone}
                            </p>
                          )}
                          {col.id === "dispatched" && (
                            <p className="mt-3 text-[11px] text-ink-soft">
                              Waiting for AMG inspection &amp; fulfill certification.
                            </p>
                          )}
                          {col.id === "fulfilled" && r.fulfilled_at && (
                            <p className="mt-3 text-[11px] text-forest">
                              Certified {new Date(r.fulfilled_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {byColumn[col.id].length === 0 && (
                  <li
                    className="rounded border border-dashed border-line px-3 py-8 text-center text-xs text-ink-soft"
                    onDragOver={allowDrop}
                    onDrop={(e) => onDropColumn(e, col.id)}
                  >
                    Drop here
                    {accepts ? " to move" : ""} ·{" "}
                    {SUPPLY_STATUS_LABELS[col.id]?.toLowerCase() ?? col.title}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {logisticsRequest && (
        <LogisticsPlanModal
          request={logisticsRequest}
          onClose={() => {
            setLogisticsForId(null);
            setContinueToDispatchId(null);
          }}
          onSubmit={async (plan) => {
            const id = logisticsRequest.id;
            const thenDispatch = continueToDispatchId === id;
            await onMove(id, "confirmed", { logistics: plan });
            setLogisticsForId(null);
            setContinueToDispatchId(null);
            if (thenDispatch) {
              // Parent reloads; open dispatch on next tick with fresh data
              window.setTimeout(() => setDispatchForId(id), 0);
            }
          }}
        />
      )}

      {dispatchRequest && (
        <DispatchDetailsModal
          request={dispatchRequest}
          onClose={() => setDispatchForId(null)}
          onSubmit={async (dispatch) => {
            await onMove(dispatchRequest.id, "dispatched", { dispatch });
            setDispatchForId(null);
          }}
        />
      )}
    </div>
  );
}

function LogisticsPlanModal({
  request,
  onClose,
  onSubmit,
}: {
  request: SupplyRequest;
  onClose: () => void;
  onSubmit: (plan: SupplyLogisticsPlan) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<SupplyMethod>("boda");
  const [town, setTown] = useState<Town>(request.customer_town);
  const [locationId, setLocationId] = useState("");
  const [dispatchAt, setDispatchAt] = useState("");
  const [notes, setNotes] = useState("");
  const [hubs, setHubs] = useState<DropoffPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaultAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    defaultAt.setMinutes(0, 0, 0);
    setDispatchAt(defaultAt.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    const points = getDemoDropoffPoints(town);
    setHubs(points);
    setLocationId((prev) => (points.some((p) => p.id === prev) ? prev : points[0]?.id ?? ""));
  }, [town]);

  const selectedHub = hubs.find((h) => h.id === locationId) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedHub || !dispatchAt) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        method,
        amg_location_id: selectedHub.id,
        amg_location_name: selectedHub.name,
        amg_location_town: selectedHub.town,
        planned_dispatch_at: new Date(dispatchAt).toISOString(),
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-charcoal/45"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void submit(e)}
        className="relative z-10 w-full max-w-md space-y-3 rounded-xl border border-line bg-white p-5 shadow-lg"
      >
        <h2 className="font-display text-2xl text-charcoal">Logistics plan</h2>
        <p className="text-sm text-ink-soft">
          Moving <span className="font-semibold">{request.id.slice(0, 12)}</span> to Confirmed.
          How will you send these items to AMG?
        </p>
        <p className="text-xs text-ink-soft">
          {request.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as SupplyMethod)}
            className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            required
          >
            {(Object.keys(SUPPLY_METHOD_LABELS) as SupplyMethod[]).map((m) => (
              <option key={m} value={m}>
                {SUPPLY_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          AMG hub town
          <select
            value={town}
            onChange={(e) => setTown(e.target.value as Town)}
            className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          >
            {TOWNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Deliver to location
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            required
          >
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Planned dispatch time
          <input
            type="datetime-local"
            required
            value={dispatchAt}
            onChange={(e) => setDispatchAt(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Notes (optional)
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>

        {error && <p className="text-sm text-ember">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Confirm & move"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function DispatchDetailsModal({
  request,
  onClose,
  onSubmit,
}: {
  request: SupplyRequest;
  onClose: () => void;
  onSubmit: (dispatch: SupplyDispatchDetails) => void | Promise<void>;
}) {
  const defaultVehicle: SupplyVehicleType =
    request.logistics?.method === "van"
      ? "van"
      : request.logistics?.method === "boda"
        ? "boda"
        : "truck";
  const [vehicleType, setVehicleType] = useState<SupplyVehicleType>(defaultVehicle);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        vehicle_type: vehicleType,
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_plate: plate,
        vehicle_description: description.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dispatch");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-charcoal/45"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void submit(e)}
        className="relative z-10 w-full max-w-md space-y-3 rounded-xl border border-line bg-white p-5 shadow-lg"
      >
        <h2 className="font-display text-2xl text-charcoal">Dispatch details</h2>
        <p className="text-sm text-ink-soft">
          Moving <span className="font-semibold">{request.id.slice(0, 12)}</span> to Dispatched.
          Enter the driver and vehicle taking goods to AMG
          {request.logistics ? ` (${request.logistics.amg_location_name})` : ""}.
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Vehicle type
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as SupplyVehicleType)}
            className="amg-select mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            required
          >
            {(Object.keys(SUPPLY_VEHICLE_LABELS) as SupplyVehicleType[]).map((v) => (
              <option key={v} value={v}>
                {SUPPLY_VEHICLE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Driver / rider name
          <input
            required
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Full name"
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Driver phone
          <input
            required
            type="tel"
            value={driverPhone}
            onChange={(e) => setDriverPhone(e.target.value)}
            placeholder="07…"
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Vehicle plate / registration
          <input
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="e.g. KDA 123A"
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal uppercase"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Vehicle description (optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Colour, make/model, trailer, etc."
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>

        {error && <p className="text-sm text-ember">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-sand-light disabled:opacity-50"
          >
            {busy ? "Saving…" : "Dispatch to AMG"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
