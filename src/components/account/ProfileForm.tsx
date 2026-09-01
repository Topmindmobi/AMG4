"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TOWNS } from "@/lib/format";
import { mapsUrlFromCoords, parseMapsUrl } from "@/lib/geo";
import { isDemoMode } from "@/lib/supabase/config";
import { updateDemoProfile } from "@/lib/store/demo-store";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import type { Town } from "@/lib/types";

export function ProfileForm({ next }: { next: string }) {
  const { user, refresh } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [town, setTown] = useState<Town>(user?.town ?? "Homabay");
  const [address, setAddress] = useState(user?.address ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [country, setCountry] = useState(user?.country ?? "Kenya");
  const [mapsUrl, setMapsUrl] = useState(user?.maps_url ?? "");
  const [lat, setLat] = useState(user?.lat != null ? String(user.lat) : "");
  const [lng, setLng] = useState(user?.lng != null ? String(user.lng) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const location = useCurrentLocation((foundLat, foundLng) => {
    setLat(String(foundLat));
    setLng(String(foundLng));
    setMapsUrl("");
  });

  const pinPreview = useMemo(() => {
    const fromUrl = mapsUrl ? parseMapsUrl(mapsUrl) : null;
    if (fromUrl) return fromUrl;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && lat && lng) {
      return { lat: latNum, lng: lngNum };
    }
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setMessage(null);

    if (!phone.trim() || !address.trim() || !city.trim() || !country.trim()) {
      setError("Phone, address, city, and country are required.");
      return;
    }

    let resolvedLat: number | null = lat ? Number(lat) : null;
    let resolvedLng: number | null = lng ? Number(lng) : null;
    const fromUrl = mapsUrl ? parseMapsUrl(mapsUrl) : null;
    if (fromUrl) {
      resolvedLat = fromUrl.lat;
      resolvedLng = fromUrl.lng;
    }
    if (
      (resolvedLat != null && !Number.isFinite(resolvedLat)) ||
      (resolvedLng != null && !Number.isFinite(resolvedLng))
    ) {
      setError("Latitude / longitude must be valid numbers.");
      return;
    }
    let resolvedMapsUrl = mapsUrl.trim() || null;
    if (!resolvedMapsUrl && resolvedLat != null && resolvedLng != null) {
      resolvedMapsUrl = mapsUrlFromCoords(resolvedLat, resolvedLng);
    }

    const patch = {
      phone: phone.trim(),
      town,
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      lat: resolvedLat,
      lng: resolvedLng,
      maps_url: resolvedMapsUrl,
    };

    setBusy(true);
    try {
      if (isDemoMode()) {
        updateDemoProfile(user.id, patch);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: updErr } = await supabase.from("profiles").update(patch).eq("id", user.id);
        if (updErr) throw updErr;
      }
      refresh();
      setMessage("Profile saved.");
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-xs uppercase tracking-wide text-ink-soft sm:col-span-2">
        Phone
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07…"
          className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
        />
      </label>

      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Town
        <select
          value={town}
          onChange={(e) => setTown(e.target.value as Town)}
          className="amg-select mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
        >
          {TOWNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs uppercase tracking-wide text-ink-soft">
        City
        <input
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Homabay"
          className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
        />
      </label>

      <label className="text-xs uppercase tracking-wide text-ink-soft sm:col-span-2">
        Street / landmark
        <input
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Road, building, gate, nearby landmark"
          className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
        />
      </label>

      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Country
        <input
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
        />
      </label>

      <div className="sm:col-span-2 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Map pin (optional)
          </p>
          <button
            type="button"
            disabled={location.busy}
            onClick={location.request}
            className="text-xs font-semibold text-forest hover:underline disabled:opacity-50"
          >
            {location.busy ? "Locating…" : "Use my current location"}
          </button>
        </div>
        {location.error && <p className="mt-1 text-xs text-ember">{location.error}</p>}
        <label className="mt-3 block text-xs uppercase tracking-wide text-ink-soft">
          Google Maps link
          <input
            value={mapsUrl}
            onChange={(e) => applyMapsPaste(e.target.value)}
            placeholder="Paste share link from Google Maps…"
            className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Latitude
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-0.5273"
              className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm text-charcoal"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Longitude
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
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

      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save profile
        </button>
      </div>
    </form>
  );
}
