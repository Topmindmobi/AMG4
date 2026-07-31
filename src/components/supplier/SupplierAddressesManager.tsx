"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { mapsUrlFromCoords, parseMapsUrl } from "@/lib/geo";
import { TOWNS } from "@/lib/format";
import {
  deleteDemoSupplierAddress,
  getDemoSupplierAddresses,
  setDemoSupplierAddressDefault,
  upsertDemoSupplierAddress,
} from "@/lib/store/demo-store";
import type { SupplierAddress, SupplierAddressLabel, Town } from "@/lib/types";

const LABEL_OPTIONS: { value: SupplierAddressLabel; label: string }[] = [
  { value: "warehouse", label: "Warehouse" },
  { value: "shop", label: "Shop" },
  { value: "pickup", label: "Pickup point" },
  { value: "other", label: "Other" },
];

type FormState = {
  id?: string;
  label: SupplierAddressLabel;
  name: string;
  town: Town;
  line1: string;
  phone: string;
  maps_url: string;
  lat: string;
  lng: string;
  is_default: boolean;
};

const emptyForm = (town: Town = "Homabay"): FormState => ({
  label: "warehouse",
  name: "",
  town,
  line1: "",
  phone: "",
  maps_url: "",
  lat: "",
  lng: "",
  is_default: false,
});

export function SupplierAddressesManager({
  supplierId,
  defaultTown,
}: {
  supplierId: string;
  defaultTown: Town | null;
}) {
  const [addresses, setAddresses] = useState<SupplierAddress[]>([]);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultTown ?? "Homabay"),
  );
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setAddresses(getDemoSupplierAddresses(supplierId));
  }

  useEffect(() => {
    reload();
  }, [supplierId]);

  const pinPreview = useMemo(() => {
    const fromUrl = form.maps_url ? parseMapsUrl(form.maps_url) : null;
    if (fromUrl) return fromUrl;
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && form.lat && form.lng) {
      return { lat, lng };
    }
    return null;
  }, [form.maps_url, form.lat, form.lng]);

  function startEdit(addr: SupplierAddress) {
    setEditing(true);
    setForm({
      id: addr.id,
      label: addr.label,
      name: addr.name,
      town: addr.town,
      line1: addr.line1,
      phone: addr.phone ?? "",
      maps_url: addr.maps_url ?? "",
      lat: addr.lat != null ? String(addr.lat) : "",
      lng: addr.lng != null ? String(addr.lng) : "",
      is_default: addr.is_default,
    });
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setEditing(false);
    setForm(emptyForm(defaultTown ?? "Homabay"));
    setError(null);
  }

  function applyMapsPaste(url: string) {
    const parsed = parseMapsUrl(url);
    setForm((f) => ({
      ...f,
      maps_url: url,
      lat: parsed ? String(parsed.lat) : f.lat,
      lng: parsed ? String(parsed.lng) : f.lng,
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.name.trim() || !form.line1.trim()) {
      setError("Name and street / landmark are required.");
      return;
    }

    let lat: number | null = form.lat ? Number(form.lat) : null;
    let lng: number | null = form.lng ? Number(form.lng) : null;
    const fromUrl = form.maps_url ? parseMapsUrl(form.maps_url) : null;
    if (fromUrl) {
      lat = fromUrl.lat;
      lng = fromUrl.lng;
    }
    if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) {
      setError("Latitude / longitude must be valid numbers.");
      return;
    }

    let maps_url = form.maps_url.trim() || null;
    if (!maps_url && lat != null && lng != null) {
      maps_url = mapsUrlFromCoords(lat, lng);
    }

    try {
      upsertDemoSupplierAddress({
        id: form.id,
        supplier_id: supplierId,
        label: form.label,
        name: form.name,
        town: form.town,
        line1: form.line1,
        phone: form.phone || null,
        maps_url,
        lat,
        lng,
        is_default: form.is_default || addresses.length === 0,
      });
      reload();
      setMessage(form.id ? "Address updated." : "Address added.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save address");
    }
  }

  return (
    <div className="space-y-8">
      <section className="border border-line bg-white p-5">
        <h2 className="font-display text-xl text-charcoal">
          {editing ? "Edit address" : "Add address"}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Enter the site details and optionally paste a Google Maps link or pin
          coordinates. Your default address is used when AMG ranks suppliers —
          closer sites mean lower estimated transport cost.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-ink-soft sm:col-span-2">
            Site name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main warehouse"
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Type
            <select
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  label: e.target.value as SupplierAddressLabel,
                }))
              }
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            >
              {LABEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Town
            <select
              value={form.town}
              onChange={(e) =>
                setForm((f) => ({ ...f, town: e.target.value as Town }))
              }
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            >
              {TOWNS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs uppercase tracking-wide text-ink-soft sm:col-span-2">
            Street / landmark
            <input
              required
              value={form.line1}
              onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              placeholder="Road, building, gate, nearby landmark"
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Contact phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="07…"
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>

          <label className="flex items-end gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.is_default || addresses.length === 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_default: e.target.checked }))
              }
              className="mt-1"
            />
            Use as default for distance ranking
          </label>

          <div className="sm:col-span-2 border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Map pin (optional but recommended)
            </p>
            <label className="mt-3 block text-xs uppercase tracking-wide text-ink-soft">
              Google Maps link
              <input
                value={form.maps_url}
                onChange={(e) => applyMapsPaste(e.target.value)}
                placeholder="Paste share link from Google Maps…"
                className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs uppercase tracking-wide text-ink-soft">
                Latitude
                <input
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="-0.5273"
                  className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-ink-soft">
                Longitude
                <input
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="34.4571"
                  className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
                />
              </label>
            </div>
            {pinPreview && (
              <p className="mt-2 text-xs text-forest">
                Pin detected: {pinPreview.lat.toFixed(5)}, {pinPreview.lng.toFixed(5)} ·{" "}
                <a
                  href={mapsUrlFromCoords(pinPreview.lat, pinPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Open in Google Maps
                </a>
              </p>
            )}
          </div>

          {error && (
            <p className="sm:col-span-2 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
              {error}
            </p>
          )}
          {message && (
            <p className="sm:col-span-2 border border-forest/30 bg-forest/5 px-3 py-2 text-sm text-charcoal">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="bg-ember px-4 py-2.5 text-sm font-semibold text-white"
            >
              {editing ? "Save changes" : "Add address"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl text-charcoal">Your addresses</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div>
                <p className="font-medium text-charcoal">
                  {addr.name}
                  {addr.is_default && (
                    <span className="ml-2 text-xs font-semibold text-ember">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {LABEL_OPTIONS.find((o) => o.value === addr.label)?.label} ·{" "}
                  {addr.town} · {addr.line1}
                </p>
                {addr.phone && (
                  <p className="mt-0.5 text-xs text-ink-soft">{addr.phone}</p>
                )}
                {addr.lat != null && addr.lng != null && (
                  <a
                    href={addr.maps_url || mapsUrlFromCoords(addr.lat, addr.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-forest underline"
                  >
                    Map pin ({addr.lat.toFixed(4)}, {addr.lng.toFixed(4)})
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => {
                      setDemoSupplierAddressDefault(addr.id, supplierId);
                      reload();
                      setMessage(`“${addr.name}” is now the default.`);
                    }}
                    className="border border-forest px-3 py-1.5 font-semibold text-forest"
                  >
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(addr)}
                  className="border border-line px-3 py-1.5 font-semibold text-ink-soft hover:text-charcoal"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Remove “${addr.name}”?`)) return;
                    deleteDemoSupplierAddress(addr.id, supplierId);
                    reload();
                    setMessage("Address removed.");
                    if (form.id === addr.id) resetForm();
                  }}
                  className="border border-ember/40 px-3 py-1.5 font-semibold text-ember"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        {addresses.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            No addresses yet. Add your warehouse or shop so AMG can estimate
            transport cost when choosing a supplier.
          </p>
        )}
      </section>
    </div>
  );
}
