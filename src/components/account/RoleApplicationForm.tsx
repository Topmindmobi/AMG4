"use client";

import { FormEvent, useMemo, useState } from "react";
import { CameraCapture } from "@/components/admin/CameraCapture";
import { useAuth } from "@/lib/auth-context";
import { RIDER_VEHICLE_LABELS, RIDER_VEHICLES, TOWNS } from "@/lib/format";
import { mapsUrlFromCoords, parseMapsUrl } from "@/lib/geo";
import { isProfileComplete } from "@/lib/profile";
import { isDemoMode } from "@/lib/supabase/config";
import { getErrorMessage } from "@/lib/supabase/errors";
import { submitDemoRoleApplication, updateDemoProfile } from "@/lib/store/demo-store";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import type { RoleApplication, RoleApplicationType, Town } from "@/lib/types";

type DocKey = "national_id" | "business_permit" | "driving_license";

const DOC_LABELS: Record<DocKey, string> = {
  national_id: "National ID",
  business_permit: "Business permit / KRA PIN",
  driving_license: "Driving license",
};

export function RoleApplicationForm({
  type,
  userId,
  email,
  onSubmitted,
}: {
  type: RoleApplicationType;
  userId: string;
  email: string;
  onSubmitted: (application: RoleApplication) => void;
}) {
  const requiredDocs: DocKey[] =
    type === "supplier" ? ["national_id", "business_permit"] : ["national_id", "driving_license"];

  const { refresh } = useAuth();
  const [docFiles, setDocFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [docPreviews, setDocPreviews] = useState<Partial<Record<DocKey, string>>>({});
  const [cameraTarget, setCameraTarget] = useState<DocKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

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

  function onCapture(file: File, dataUrl: string) {
    if (!cameraTarget) return;
    setDocFiles((f) => ({ ...f, [cameraTarget]: file }));
    setDocPreviews((p) => ({ ...p, [cameraTarget]: dataUrl }));
    setCameraTarget(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const missing = requiredDocs.filter((d) => !docFiles[d]);
    if (missing.length > 0) {
      setError(`Please add: ${missing.map((d) => DOC_LABELS[d]).join(", ")}`);
      return;
    }

    const contact_phone = String(fd.get("contact_phone") || "").trim();
    const town = String(fd.get("town") || "") as Town | "";
    const address = String(fd.get("address") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const country = String(fd.get("country") || "").trim();

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

    if (
      !isProfileComplete(
        { phone: contact_phone, town: town || null, address, city, country, lat: resolvedLat, lng: resolvedLng },
        { requirePin: true },
      )
    ) {
      setError("Phone, town, address, city, country, and a map pin are all required.");
      return;
    }

    const profilePatch = {
      phone: contact_phone,
      town: town as Town,
      address,
      city,
      country,
      lat: resolvedLat,
      lng: resolvedLng,
      maps_url: resolvedMapsUrl,
    };

    const base = {
      user_id: userId,
      type,
      email,
      business_name: type === "supplier" ? String(fd.get("business_name") || "").trim() || null : null,
      vehicle: type === "rider" ? String(fd.get("vehicle") || "boda") : null,
      contact_phone,
      town: town as Town,
      notes: String(fd.get("notes") || "").trim() || null,
    };

    setLoading(true);
    try {
      if (isDemoMode()) {
        updateDemoProfile(userId, profilePatch);
        refresh();
        const created = submitDemoRoleApplication({
          ...base,
          national_id_path: docPreviews.national_id ?? null,
          business_permit_path: docPreviews.business_permit ?? null,
          driving_license_path: docPreviews.driving_license ?? null,
        });
        onSubmitted(created);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("id", userId);
      if (profileErr) throw profileErr;
      refresh();

      async function uploadDoc(key: DocKey): Promise<string | null> {
        const file = docFiles[key];
        if (!file) return null;
        const path = `${userId}/${key}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, file, {
          upsert: true,
        });
        if (upErr) throw upErr;
        return path;
      }

      const [national_id_path, business_permit_path, driving_license_path] = await Promise.all([
        uploadDoc("national_id"),
        uploadDoc("business_permit"),
        uploadDoc("driving_license"),
      ]);

      const { data: inserted, error: insErr } = await supabase
        .from("role_applications")
        .insert({
          ...base,
          national_id_path,
          business_permit_path,
          driving_license_path,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      onSubmitted(inserted as RoleApplication);
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit application"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-4">
      {type === "supplier" && (
        <label className="text-xs uppercase tracking-wide text-ink-soft">
          Business / shop name
          <input
            name="business_name"
            required
            placeholder="e.g. Lakeview Electronics"
            className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
          />
        </label>
      )}
      {type === "rider" && (
        <label className="text-xs uppercase tracking-wide text-ink-soft">
          Vehicle
          <select
            name="vehicle"
            defaultValue="boda"
            className="amg-select mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
          >
            {RIDER_VEHICLES.map((v) => (
              <option key={v} value={v}>
                {RIDER_VEHICLE_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Contact phone
        <input
          name="contact_phone"
          required
          placeholder="07…"
          className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        />
      </label>
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Town
        <select
          name="town"
          required
          defaultValue=""
          className="amg-select mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        >
          <option value="" disabled>
            Choose a town
          </option>
          {TOWNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Street / landmark
        <input
          name="address"
          required
          placeholder="Road, building, gate, nearby landmark"
          className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        />
      </label>
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        City
        <input
          name="city"
          required
          placeholder="e.g. Homabay"
          className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        />
      </label>
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Country
        <input
          name="country"
          required
          defaultValue="Kenya"
          className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        />
      </label>

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Map pin (required — AMG uses this for pickup/delivery logistics)
          </p>
          <button
            type="button"
            disabled={location.busy}
            onClick={location.request}
            className="shrink-0 text-xs font-semibold text-forest hover:underline disabled:opacity-50"
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
            className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Latitude
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-0.5273"
              className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-ink-soft">
            Longitude
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="34.4571"
              className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
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
      <label className="text-xs uppercase tracking-wide text-ink-soft">
        Notes (optional)
        <textarea
          name="notes"
          rows={3}
          placeholder={type === "supplier" ? "What do you sell?" : "Anything admin should know"}
          className="mt-1 block w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal"
        />
      </label>

      <div className="border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Required documents
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {requiredDocs.map((doc) => (
            <div key={doc} className="rounded-lg border-[1.5px] border-line p-3">
              <p className="text-sm font-medium text-charcoal">{DOC_LABELS[doc]}</p>
              {docPreviews[doc] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={docPreviews[doc]}
                  alt={DOC_LABELS[doc]}
                  className="mt-2 h-32 w-full rounded-lg object-cover"
                />
              ) : (
                <p className="mt-1 text-xs text-ink-soft">Not added yet</p>
              )}
              <button
                type="button"
                onClick={() => setCameraTarget(doc)}
                className="mt-2 text-xs font-semibold text-forest hover:underline"
              >
                {docPreviews[doc] ? "Retake" : "Add photo"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border-[1.5px] border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit application"}
      </button>

      <CameraCapture open={cameraTarget !== null} onClose={() => setCameraTarget(null)} onCapture={onCapture} />
    </form>
  );
}
