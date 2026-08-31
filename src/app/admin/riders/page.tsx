"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RIDER_VEHICLE_LABELS, RIDER_VEHICLES, TOWNS } from "@/lib/format";
import { mapsUrlFromCoords, parseMapsUrl } from "@/lib/geo";
import { isDemoMode } from "@/lib/supabase/config";
import { getAllDemoRiders, upsertDemoRider } from "@/lib/store/demo-store";
import type { Rider, RiderVehicleType, Town } from "@/lib/types";

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [editing, setEditing] = useState<Rider | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const pinPreview = useMemo(() => {
    const fromUrl = mapsUrl ? parseMapsUrl(mapsUrl) : null;
    if (fromUrl) return fromUrl;
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln) && lat && lng) return { lat: la, lng: ln };
    return null;
  }, [mapsUrl, lat, lng]);

  function applyMapsPaste(url: string) {
    const parsed = parseMapsUrl(url);
    setMapsUrl(url);
    if (parsed) {
      setLat(String(parsed.lat));
      setLng(String(parsed.lng));
    }
  }

  function loadPinFields(rider: Rider | null) {
    setMapsUrl(rider?.maps_url ?? "");
    setLat(rider?.lat != null ? String(rider.lat) : "");
    setLng(rider?.lng != null ? String(rider.lng) : "");
  }

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

    let pinLat: number | null = lat ? Number(lat) : null;
    let pinLng: number | null = lng ? Number(lng) : null;
    const fromUrl = mapsUrl ? parseMapsUrl(mapsUrl) : null;
    if (fromUrl) {
      pinLat = fromUrl.lat;
      pinLng = fromUrl.lng;
    }
    let mapsUrlToSave = mapsUrl.trim() || null;
    if (!mapsUrlToSave && pinLat != null && pinLng != null) {
      mapsUrlToSave = mapsUrlFromCoords(pinLat, pinLng);
    }

    const payload = {
      id: editing?.id,
      name: String(fd.get("name")),
      phone: String(fd.get("phone") || "") || null,
      town: (String(fd.get("town") || "") || null) as Town | null,
      vehicle: String(fd.get("vehicle") || "boda") as RiderVehicleType,
      active: fd.get("active") === "on",
      lat: pinLat,
      lng: pinLng,
      maps_url: mapsUrlToSave,
    };

    if (isDemoMode()) {
      upsertDemoRider(payload);
      setEditing(null);
      loadPinFields(null);
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
        lat: payload.lat,
        lng: payload.lng,
        maps_url: payload.maps_url,
      });
    }
    setEditing(null);
    loadPinFields(null);
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
          key={`${editing?.id ?? "new"}-phone`}
          className="border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          name="town"
          defaultValue={editing?.town ?? ""}
          key={`${editing?.id ?? "new"}-town`}
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
          key={`${editing?.id ?? "new"}-vehicle`}
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

        <div className="border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Base location pin (optional)
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Used to rank this rider by distance when dispatching orders. Without
            a pin, riders are still ranked using their town.
          </p>
          <input
            value={mapsUrl}
            onChange={(e) => applyMapsPaste(e.target.value)}
            placeholder="Paste share link from Google Maps…"
            className="mt-2 w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              className="border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude"
              className="border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </div>
          {pinPreview && (
            <p className="mt-2 text-xs text-forest">
              Pin detected: {pinPreview.lat.toFixed(5)}, {pinPreview.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-ember px-4 py-2 text-sm font-semibold text-white">
            {editing ? "Update" : "Add rider"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                loadPinFields(null);
              }}
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
              {r.lat != null && r.lng != null ? (
                <a
                  href={r.maps_url || mapsUrlFromCoords(r.lat, r.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-block text-xs text-forest underline"
                >
                  Pin set ({r.lat.toFixed(4)}, {r.lng.toFixed(4)})
                </a>
              ) : (
                <p className="mt-0.5 text-xs text-ink-soft">No pin — ranked by town only</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(r);
                loadPinFields(r);
              }}
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
