import { distanceToHubKm } from "@/lib/geo";
import type { Rider, Town } from "@/lib/types";

export interface RankedRider {
  rider: Rider;
  distanceKm: number;
}

/**
 * Ranks riders nearest-first for a given order town. Uses each rider's
 * pinned lat/lng when set (see 029_rider_pin_location.sql), falling back to
 * the same town-centroid/TOWN_DISTANCE_KM logic already used for supplier
 * distances (distanceToHubKm) — so riders without a pin still rank
 * sensibly, not just the ones an admin has bothered to pin.
 */
export function rankRidersByDistance(riders: Rider[], orderTown: Town): RankedRider[] {
  return riders
    .map((rider) => ({
      rider,
      distanceKm: distanceToHubKm({
        fromTown: rider.town,
        fromLat: rider.lat,
        fromLng: rider.lng,
        hubTown: orderTown,
      }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
