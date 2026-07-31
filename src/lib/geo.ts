import type { Town } from "@/lib/types";

/** Approximate town centres used when an address has no pin. */
export const TOWN_COORDS: Record<Town, { lat: number; lng: number }> = {
  Homabay: { lat: -0.5273, lng: 34.4571 },
  Mbita: { lat: -0.4215, lng: 34.2056 },
  Migori: { lat: -1.0634, lng: 34.4731 },
};

/** Road-ish distance proxy between towns (km). */
export const TOWN_DISTANCE_KM: Record<Town, Record<Town, number>> = {
  Homabay: { Homabay: 0, Mbita: 28, Migori: 62 },
  Mbita: { Homabay: 28, Mbita: 0, Migori: 48 },
  Migori: { Homabay: 62, Mbita: 48, Migori: 0 },
};

/** Base + per-km estimate for supplier → AMG hub inbound transport (KES). */
export const TRANSPORT_BASE_KES = 200;
export const TRANSPORT_PER_KM_KES = 35;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Pull lat/lng from a Google Maps share / place / directions URL. */
export function parseMapsUrl(url: string): { lat: number; lng: number } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const patterns: RegExp[] = [
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /place\/[^/]+\/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  // Plain "lat,lng" paste
  const plain = trimmed.match(/^(-?\d+\.?\d+)\s*,\s*(-?\d+\.?\d+)$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

export function mapsUrlFromCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function estimateTransportKes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  return Math.round(TRANSPORT_BASE_KES + distanceKm * TRANSPORT_PER_KM_KES);
}

export function distanceScoreFromKm(km: number): number {
  // 0 km → 100, ~80+ km → ~20
  return Math.max(20, Math.round(100 - km * 1.2));
}

/**
 * Distance from a supplier origin (coords or town) to the AMG hub town
 * that serves the customer order.
 */
export function distanceToHubKm(opts: {
  fromTown: Town | null;
  fromLat?: number | null;
  fromLng?: number | null;
  hubTown: Town;
}): number {
  const hub = TOWN_COORDS[opts.hubTown];
  if (
    opts.fromLat != null &&
    opts.fromLng != null &&
    Number.isFinite(opts.fromLat) &&
    Number.isFinite(opts.fromLng)
  ) {
    return Math.round(haversineKm({ lat: opts.fromLat, lng: opts.fromLng }, hub) * 10) / 10;
  }
  if (!opts.fromTown) return 80;
  return TOWN_DISTANCE_KM[opts.fromTown][opts.hubTown];
}
