import type { Town } from "@/lib/types";

const PREFILL_KEY = "amg_guest_prefill_v1";

export type GuestCheckoutPrefill = {
  fullName: string;
  phone: string;
  email: string;
  town: Town | null;
  address: string;
};

export function stashGuestCheckoutPrefill(details: GuestCheckoutPrefill) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(details));
  } catch {
    // ignore
  }
}

export function consumeGuestCheckoutPrefill(): GuestCheckoutPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    return JSON.parse(raw) as GuestCheckoutPrefill;
  } catch {
    return null;
  }
}
