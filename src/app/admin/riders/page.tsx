"use client";

import { FormEvent, useEffect, useState } from "react";
import { RIDER_VEHICLE_LABELS, RIDER_VEHICLES, TOWNS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getAllDemoRiders, upsertDemoRider } from "@/lib/store/demo-store";
import type { Rider, RiderVehicleType, Town } from "@/lib/types";

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [editing, setEditing] = useState<Rider | null>(null);

  function load() {
    if (isDemoMode()) {
      void Promise.resolve(getAllDemoRiders()).then(setRiders);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("riders").select("*").order("name");
      setRiders((data as Rider[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: editing?.id,
      name: String(fd.get("name")),
      phone: String(fd.get("phone") || "") || null,
      town: (String(fd.get("town") || "") || null) as Town | null,
      vehicle: String(fd.get("vehicle") || "boda") as RiderVehicleType,
      active: fd.get("active") === "on",
    };

    if (isDemoMode()) {
      upsertDemoRider(payload);
      setEditing(null);
      (e.target as HTMLFormElement).reset();
      load();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    if (editing?.id) {
      await supabase.from("riders").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("riders").insert({
        name: payload.name,
        phone: payload.phone,
        town: payload.town,
        vehicle: payload.vehicle,
        active: payload.active,
      });
    }
    setEditing(null);
    (e.target as HTMLFormElement).reset();
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Riders</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Motorcycle, van, and truck riders available for last-mile delivery dispatch.
      </p>
      <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-3">
        <input
          name="name"
          required
          placeholder="Rider name"
          defaultValue={editing?.name}
          key={editing?.id ?? "new"}
          className="border border-line bg-white px-3 py-2 text-sm"
        />
        <input
          name="phone"
          placeholder="Phone"
          defaultValue={editing?.phone ?? ""}
          className="border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          name="town"
          defaultValue={editing?.town ?? ""}
          className="amg-select border border-line bg-white px-3 py-2 text-sm text-charcoal"
        >
          <option value="">Town</option>
          {TOWNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          name="vehicle"
          defaultValue={editing?.vehicle ?? "boda"}
          className="amg-select border border-line bg-white px-3 py-2 text-sm text-charcoal"
        >
          {RIDER_VEHICLES.map((v) => (
            <option key={v} value={v}>
              {RIDER_VEHICLE_LABELS[v]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            name="active"
            defaultChecked={editing?.active ?? true}
            key={`${editing?.id ?? "new"}-active`}
          />
          Active (available for dispatch)
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-ember px-4 py-2 text-sm font-semibold text-white">
            {editing ? "Update" : "Add rider"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm text-ink-soft"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {riders.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">
                {r.name}
                {!r.active && (
                  <span className="ml-2 text-xs font-normal text-ink-soft">(inactive)</span>
                )}
              </p>
              <p className="text-xs text-ink-soft">
                {r.phone || "No phone"} · {r.town || "—"} · {RIDER_VEHICLE_LABELS[r.vehicle] ?? r.vehicle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(r)}
              className="text-ink-soft hover:text-ember"
            >
              Edit
            </button>
          </li>
        ))}
        {riders.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-soft">No riders yet.</li>
        )}
      </ul>
    </div>
  );
}
