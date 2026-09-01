import type { Profile } from "@/lib/types";

type ProfileFields = Pick<
  Profile,
  "phone" | "town" | "address" | "city" | "country" | "lat" | "lng"
>;

function hasText(v: string | null | undefined): boolean {
  return Boolean(v && v.trim().length > 0);
}

/**
 * Base completeness = phone, town, address, city, country all set. Pin
 * location (lat/lng) is opt-in via requirePin — required for supplier/rider
 * applications (logistics-critical, feeds distance/ranking math), optional
 * for a plain customer profile (nothing today depends on a customer's pin).
 */
export function isProfileComplete(
  profile: ProfileFields | null | undefined,
  opts: { requirePin?: boolean } = {},
): boolean {
  if (!profile) return false;
  const base =
    hasText(profile.phone) &&
    hasText(profile.town) &&
    hasText(profile.address) &&
    hasText(profile.city) &&
    hasText(profile.country);
  if (!base) return false;
  if (opts.requirePin) return profile.lat != null && profile.lng != null;
  return true;
}
