"use client";

import { useCallback, useState } from "react";

/**
 * One-click "use my current location" for pin-capture forms — a convenience
 * alongside the existing paste-a-Maps-link / type-lat-lng options (see
 * src/lib/geo.ts), not a replacement. Deliberately only fires on a user
 * gesture (the returned `request` is meant to be wired to a button's
 * onClick) — browsers require that for the geolocation permission prompt,
 * and it also matches "[optional]" in how this was asked for.
 */
export function useCurrentLocation(onFound: (lat: number, lng: number) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't available in this browser.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFound(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
      },
      (err) => {
        setError(err.message || "Could not get your location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [onFound]);

  return { request, busy, error };
}
