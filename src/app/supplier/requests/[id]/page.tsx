"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  formatKes,
  SUPPLY_METHOD_LABELS,
  SUPPLY_STATUS_LABELS,
  SUPPLY_VEHICLE_LABELS,
  TOWNS,
} from "@/lib/format";
import {
  confirmDemoSupplyRequest,
  dispatchDemoSupplyRequest,
  getDemoDropoffPoints,
  getDemoSupplyRequest,
} from "@/lib/store/demo-store";
import type {
  DropoffPoint,
  SupplyMethod,
  SupplyRequest,
  SupplyVehicleType,
  Town,
} from "@/lib/types";

export default function SupplierRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { supplierId } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<SupplyRequest | null>(null);
  const [hubs, setHubs] = useState<DropoffPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [method, setMethod] = useState<SupplyMethod>("boda");
  const [town, setTown] = useState<Town>("Homabay");
  const [locationId, setLocationId] = useState("");
  const [dispatchAt, setDispatchAt] = useState("");
  const [notes, setNotes] = useState("");

  const [vehicleType, setVehicleType] = useState<SupplyVehicleType>("boda");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");

  useEffect(() => {
    const r = getDemoSupplyRequest(params.id);
    if (r && supplierId && r.supplier_id !== supplierId) {
      router.replace("/supplier/requests");
      return;
    }
    void Promise.resolve(r).then((req) => {
      setRequest(req);
      if (req) {
        setTown(req.customer_town);
        const defaultAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        defaultAt.setMinutes(0, 0, 0);
        setDispatchAt(defaultAt.toISOString().slice(0, 16));
      }
    });
  }, [params.id, supplierId, router]);

  useEffect(() => {
    const points = getDemoDropoffPoints(town);
    setHubs(points);
    setLocationId((prev) => (points.some((p) => p.id === prev) ? prev : points[0]?.id ?? ""));
  }, [town]);

  const selectedHub = useMemo(
    () => hubs.find((h) => h.id === locationId) ?? null,
    [hubs, locationId],
  );

  function confirm(e: FormEvent) {
    e.preventDefault();
    if (!request || !selectedHub) return;
    setLoading(true);
    setError(null);
    try {
      const updated = confirmDemoSupplyRequest(request.id, {
        method,
        amg_location_id: selectedHub.id,
        amg_location_name: selectedHub.name,
        amg_location_town: selectedHub.town,
        planned_dispatch_at: new Date(dispatchAt).toISOString(),
        notes: notes.trim() || null,
      });
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm");
    } finally {
      setLoading(false);
    }
  }

  function markDispatched(e: FormEvent) {
    e.preventDefault();
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      setRequest(
        dispatchDemoSupplyRequest(request.id, {
          vehicle_type: vehicleType,
          driver_name: driverName,
          driver_phone: driverPhone,
          vehicle_plate: vehiclePlate,
          vehicle_description: vehicleDescription.trim() || null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dispatch");
    } finally {
      setLoading(false);
    }
  }

  if (!request) {
    return <p className="text-ink-soft">Loading request…</p>;
  }

  return (
    <div>
      <Link href="/supplier/requests" className="text-sm text-ink-soft hover:text-ember">
        ← Orders pipeline
      </Link>
      <h1 className="mt-4 font-display text-3xl text-charcoal">Supply request</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Status: <span className="font-semibold text-charcoal">{SUPPLY_STATUS_LABELS[request.status]}</span>
      </p>

      <div className="mt-6 border border-line bg-white p-4 text-sm">
        <p className="text-ink-soft">{request.delivery_note}</p>
        <p className="mt-3 text-xs text-ink-soft">
          Order {request.order_id} · AMG client town: {request.customer_town}
        </p>
      </div>

      <h2 className="mt-8 font-display text-xl text-charcoal">Items &amp; quantities</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {request.items.map((item) => (
          <li key={item.order_item_id} className="flex justify-between py-3 text-sm">
            <span>
              {item.qty}× {item.name}
            </span>
            <span>{formatKes(item.price_kes * item.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right text-lg font-semibold text-ember">
        Total {formatKes(request.total_kes)}
      </p>

      {request.logistics && (
        <section className="mt-8 rounded-lg border border-forest/20 bg-forest/5 p-4">
          <h2 className="font-display text-xl text-charcoal">Logistics plan → AMG</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Method</dt>
              <dd className="font-medium text-charcoal">
                {SUPPLY_METHOD_LABELS[request.logistics.method] ?? request.logistics.method}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">AMG location</dt>
              <dd className="font-medium text-charcoal">
                {request.logistics.amg_location_name} ({request.logistics.amg_location_town})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Planned dispatch</dt>
              <dd className="font-medium text-charcoal">
                {new Date(request.logistics.planned_dispatch_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Notes</dt>
              <dd className="font-medium text-charcoal">{request.logistics.notes || "—"}</dd>
            </div>
          </dl>
          {request.dispatched_at && (
            <p className="mt-3 text-xs text-ink-soft">
              Dispatched {new Date(request.dispatched_at).toLocaleString()}
            </p>
          )}
          {request.fulfilled_at && (
            <p className="mt-1 text-xs font-semibold text-forest">
              AMG certified fulfilled {new Date(request.fulfilled_at).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {request.dispatch && (
        <section className="mt-6 rounded-lg border border-line bg-white p-4">
          <h2 className="font-display text-xl text-charcoal">Driver &amp; vehicle</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Vehicle</dt>
              <dd className="font-medium text-charcoal">
                {SUPPLY_VEHICLE_LABELS[request.dispatch.vehicle_type]} ·{" "}
                {request.dispatch.vehicle_plate}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Driver</dt>
              <dd className="font-medium text-charcoal">
                {request.dispatch.driver_name} · {request.dispatch.driver_phone}
              </dd>
            </div>
            {request.dispatch.vehicle_description && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Description</dt>
                <dd className="font-medium text-charcoal">
                  {request.dispatch.vehicle_description}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-ember">{error}</p>}

      {(request.status === "pending" ||
        (request.status === "confirmed" && !request.logistics)) && (
        <form onSubmit={confirm} className="mt-8 space-y-4 border border-line bg-white p-4">
          <h2 className="font-display text-xl text-charcoal">
            {request.status === "pending"
              ? "Confirm & logistics plan"
              : "Add logistics plan (required before dispatch)"}
          </h2>
          <p className="text-sm text-ink-soft">
            Tell AMG how you will send these items to an AMG hub — method, quantity above, dispatch
            time, and destination location.
          </p>

          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            How will you send to AMG?
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
            Deliver to which AMG location?
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
            {selectedHub?.description && (
              <span className="mt-1 block text-xs font-normal normal-case text-ink-soft">
                {selectedHub.description}
              </span>
            )}
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
              placeholder="Vehicle plate, contact on arrival, etc."
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading
              ? "Saving…"
              : request.status === "pending"
                ? "Confirm supply + save logistics plan"
                : "Save logistics plan"}
          </button>
        </form>
      )}

      {request.status === "confirmed" && request.logistics && (
        <form onSubmit={markDispatched} className="mt-8 space-y-4 border border-line bg-white p-4">
          <h2 className="font-display text-xl text-charcoal">Dispatch — driver &amp; vehicle</h2>
          <p className="text-sm text-ink-soft">
            Enter who is delivering to AMG and which boda, van, or truck they are using.
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
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Vehicle plate
            <input
              required
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="e.g. KDA 123A"
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal uppercase"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Vehicle description (optional)
            <input
              value={vehicleDescription}
              onChange={(e) => setVehicleDescription(e.target.value)}
              placeholder="Colour, make/model…"
              className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="bg-forest px-5 py-2.5 text-sm font-semibold text-sand-light disabled:opacity-60"
          >
            {loading ? "Updating…" : "Mark as dispatched to AMG"}
          </button>
        </form>
      )}

      {request.status === "dispatched" && (
        <p className="mt-6 text-sm text-ink-soft">
          In transit to AMG. When goods arrive and pass inspection, AMG will certify this order as
          fulfilled — you cannot mark fulfilled yourself.
        </p>
      )}

      {request.status === "fulfilled" && (
        <p className="mt-6 text-sm font-medium text-forest">
          Fulfilled — AMG has inspected and accepted this supply.
        </p>
      )}
    </div>
  );
}
