"use client";

/**
 * Demo-mode auth: session, login/signup, guest-checkout account creation,
 * account deletion. Part of the `demo-store.ts` module split — see that
 * file. Includes the literal in-file plaintext demo password map
 * (`ensureSeeded()`'s credential seed, in `./core`) the original audit
 * flagged — unchanged by the split, since demo credentials are intentionally
 * public/known (they're printed on the login page itself in demo mode).
 */

import {
  DEMO_ADMIN,
  DEMO_CUSTOMER,
  DEMO_ORDERS,
  DEMO_RIDER_USERS,
  DEMO_SUPPLIER_USERS,
} from "@/lib/demo-data";
import type {
  EnsureCustomerAccountInput,
  EnsureCustomerAccountResult,
  GuestIdentityLookup,
} from "@/lib/auth/ensure-customer-account";
import { generateTemporaryPassword } from "@/lib/auth/password";
import {
  guestEmailFromPhone,
  isGuestPhoneEmail,
  normalizeKenyaPhone,
  phonesMatch,
} from "@/lib/phone";
import type { AppNotification, Order, Profile, QuoteRequest, Town } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";

const SUPPLIER_LOGINS: Record<string, string> = {
  "lakeview@amg.com": "demo-supplier-1",
  "ruma@amg.com": "demo-supplier-2",
  "migori@amg.com": "demo-supplier-3",
};

const RIDER_LOGINS: Record<string, string> = {
  "brian@amg.com": "demo-rider-1",
  "faith@amg.com": "demo-rider-2",
  "kevin@amg.com": "demo-rider-3",
};

function readCredentials(): Record<string, string> {
  ensureSeeded();
  return read<Record<string, string>>(KEYS.credentials, {});
}

function writeCredential(email: string, password: string) {
  const creds = readCredentials();
  write(KEYS.credentials, { ...creds, [email.trim().toLowerCase()]: password });
}

function findDemoProfileByEmail(normalized: string): Profile | null {
  ensureSeeded();
  const profiles = read<Profile[]>(KEYS.profiles, []);
  if (normalized === "admin@amg.com") {
    return profiles.find((p) => p.id === DEMO_ADMIN.id) ?? DEMO_ADMIN;
  }
  if (normalized === "customer@amg.com") {
    return profiles.find((p) => p.id === DEMO_CUSTOMER.id) ?? DEMO_CUSTOMER;
  }
  if (SUPPLIER_LOGINS[normalized]) {
    return (
      profiles.find((p) => p.id === SUPPLIER_LOGINS[normalized]) ||
      DEMO_SUPPLIER_USERS.find((p) => p.id === SUPPLIER_LOGINS[normalized]) ||
      null
    );
  }
  if (RIDER_LOGINS[normalized]) {
    return (
      profiles.find((p) => p.id === RIDER_LOGINS[normalized]) ||
      DEMO_RIDER_USERS.find((p) => p.id === RIDER_LOGINS[normalized]) ||
      null
    );
  }
  return profiles.find((p) => p.id === `user-${normalized}`) ?? null;
}

export interface DemoSession {
  user: Profile;
  email: string;
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  ensureSeeded();
  return read<DemoSession | null>(KEYS.session, null);
}

export function demoLogin(email: string, password: string): DemoSession {
  ensureSeeded();
  const normalized = email.trim().toLowerCase();
  const creds = readCredentials();
  const stored = creds[normalized];

  if (normalized === "admin@amg.com" && password === (stored ?? "admin123")) {
    const s = { user: DEMO_ADMIN, email: normalized };
    write(KEYS.session, s);
    return s;
  }
  if (normalized === "customer@amg.com" && password === (stored ?? "customer123")) {
    const s = { user: DEMO_CUSTOMER, email: normalized };
    write(KEYS.session, s);
    return s;
  }
  if (SUPPLIER_LOGINS[normalized] && password === (stored ?? "supplier123")) {
    const profiles = read<Profile[]>(KEYS.profiles, []);
    const profile =
      profiles.find((p) => p.id === SUPPLIER_LOGINS[normalized]) ||
      DEMO_SUPPLIER_USERS.find((p) => p.id === SUPPLIER_LOGINS[normalized])!;
    const s = { user: profile, email: normalized };
    write(KEYS.session, s);
    return s;
  }
  if (RIDER_LOGINS[normalized] && password === (stored ?? "rider123")) {
    const profiles = read<Profile[]>(KEYS.profiles, []);
    const profile =
      profiles.find((p) => p.id === RIDER_LOGINS[normalized]) ||
      DEMO_RIDER_USERS.find((p) => p.id === RIDER_LOGINS[normalized])!;
    const s = { user: profile, email: normalized };
    write(KEYS.session, s);
    return s;
  }

  const existing = findDemoProfileByEmail(normalized);
  if (existing) {
    if (stored !== undefined && stored !== password) {
      throw new Error("Invalid email or password");
    }
    // Legacy profiles without a stored password: accept and persist this login password.
    if (stored === undefined) writeCredential(normalized, password);
    const s = { user: existing, email: normalized };
    write(KEYS.session, s);
    return s;
  }

  throw new Error("Invalid email or password");
}

export function demoSignup(
  email: string,
  password: string,
  fullName: string,
): DemoSession {
  ensureSeeded();
  const normalized = email.trim().toLowerCase();
  if (findDemoProfileByEmail(normalized)) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }
  const profiles = read<Profile[]>(KEYS.profiles, []);
  const profile: Profile = {
    id: `user-${normalized}`,
    full_name: fullName,
    phone: null,
    role: "customer",
    town: null,
    supplier_id: null,
    rider_id: null,
    created_at: new Date().toISOString(),
  };
  write(
    KEYS.profiles,
    [...profiles.filter((p) => p.id !== profile.id), profile],
  );
  writeCredential(normalized, password);
  const s = { user: profile, email: normalized };
  write(KEYS.session, s);
  return s;
}

function demoProfileLoginEmail(profile: Profile): string {
  if (profile.id.startsWith("user-")) return profile.id.slice("user-".length);
  if (profile.id === DEMO_CUSTOMER.id) return "customer@amg.com";
  if (profile.id === DEMO_ADMIN.id) return "admin@amg.com";
  for (const [email, id] of Object.entries(SUPPLIER_LOGINS)) {
    if (id === profile.id) return email;
  }
  for (const [email, id] of Object.entries(RIDER_LOGINS)) {
    if (id === profile.id) return email;
  }
  if (profile.phone) {
    const e164 = normalizeKenyaPhone(profile.phone);
    if (e164) return guestEmailFromPhone(e164);
  }
  return `${profile.id}@amg.guest`;
}

function findDemoProfileByPhone(phone: string): Profile | null {
  ensureSeeded();
  const profiles = read<Profile[]>(KEYS.profiles, []);
  return profiles.find((p) => phonesMatch(p.phone, phone)) ?? null;
}

type EditableProfileFields = Pick<
  Profile,
  "full_name" | "phone" | "town" | "address" | "city" | "country" | "lat" | "lng" | "maps_url"
>;

function patchDemoProfile(
  profileId: string,
  patch: Partial<EditableProfileFields>,
): Profile | null {
  const profiles = read<Profile[]>(KEYS.profiles, []);
  const idx = profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;
  const next = { ...profiles[idx]!, ...patch };
  const copy = [...profiles];
  copy[idx] = next;
  write(KEYS.profiles, copy);
  return next;
}

/** Keep an active demo session's cached user in sync after a profile edit. */
function syncSessionProfile(next: Profile | null) {
  if (!next) return;
  const session = read<DemoSession | null>(KEYS.session, null);
  if (session && session.user.id === next.id) {
    write(KEYS.session, { ...session, user: next });
  }
}

/** User editing their own phone/town/address/city/country/pin from /account/profile. */
export function updateDemoProfile(
  profileId: string,
  patch: Partial<
    Pick<Profile, "phone" | "town" | "address" | "city" | "country" | "lat" | "lng" | "maps_url">
  >,
): Profile | null {
  const next = patchDemoProfile(profileId, patch);
  syncSessionProfile(next);
  return next;
}

function resolveGuestTown(town?: string | null): Town | null {
  return town === "Homabay" || town === "Mbita" || town === "Migori" ? town : null;
}

/**
 * Guest checkout: create a customer account for email and/or phone if none exists.
 * Does not sign the user in. Never throws for "already exists".
 */
export function ensureDemoCustomerAccount(
  input: EnsureCustomerAccountInput,
): EnsureCustomerAccountResult {
  ensureSeeded();
  const rawEmail = input.email?.trim().toLowerCase() || "";
  const phoneE164 = input.phone ? normalizeKenyaPhone(input.phone) : null;
  const hasEmail = Boolean(rawEmail && rawEmail.includes("@"));

  if (!hasEmail && !phoneE164) {
    return {
      userId: null,
      created: false,
      existed: false,
      email: rawEmail,
      phone: null,
      error: "Email or valid Kenya phone required",
    };
  }

  const email = hasEmail
    ? rawEmail
    : guestEmailFromPhone(phoneE164!);

  const byEmail = hasEmail ? findDemoProfileByEmail(email) : null;
  const byPhone = phoneE164 ? findDemoProfileByPhone(phoneE164) : null;
  const existing = byEmail ?? byPhone;

  if (existing) {
    const loginEmail = byEmail ? email : demoProfileLoginEmail(existing);
    patchDemoProfile(existing.id, {
      full_name: input.fullName.trim() || existing.full_name,
      phone: phoneE164 ?? existing.phone,
      town: resolveGuestTown(input.town) ?? existing.town,
    });
    return {
      userId: existing.id,
      created: false,
      existed: true,
      email: loginEmail,
      phone: phoneE164 ?? existing.phone,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const profiles = read<Profile[]>(KEYS.profiles, []);
  const profile: Profile = {
    id: `user-${email}`,
    full_name:
      input.fullName.trim() ||
      (hasEmail ? email.split("@")[0] : phoneE164) ||
      "Customer",
    phone: phoneE164,
    role: "customer",
    town: resolveGuestTown(input.town),
    supplier_id: null,
    rider_id: null,
    created_at: new Date().toISOString(),
  };
  write(KEYS.profiles, [...profiles, profile]);
  writeCredential(email, temporaryPassword);

  return {
    userId: profile.id,
    created: true,
    existed: false,
    email,
    phone: phoneE164,
    temporaryPassword,
  };
}

/** Look up a returning guest by phone — profile + last order address. No password. */
export function lookupDemoGuestByPhone(phone: string): GuestIdentityLookup {
  ensureSeeded();
  const phoneE164 = normalizeKenyaPhone(phone);
  if (!phoneE164) {
    return {
      found: false,
      email: null,
      loginEmail: null,
      fullName: null,
      phone: null,
      town: null,
      address: null,
      error: "Enter a valid Kenya phone (07…, +254…, or 254…)",
    };
  }

  const profile = findDemoProfileByPhone(phoneE164);
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS)
    .filter((o) => phonesMatch(o.phone, phoneE164) || (profile && o.user_id === profile.id))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const lastOrder = orders[0] ?? null;

  if (!profile && !lastOrder) {
    return {
      found: false,
      email: null,
      loginEmail: null,
      fullName: null,
      phone: phoneE164,
      town: null,
      address: null,
      error: "No account found for that phone. Checkout as guest to create one.",
    };
  }

  const email = profile ? demoProfileLoginEmail(profile) : lastOrder?.email ?? null;
  const displayEmail =
    email && !isGuestPhoneEmail(email) ? email : lastOrder?.email && !isGuestPhoneEmail(lastOrder.email)
      ? lastOrder.email
      : null;

  return {
    found: true,
    email: displayEmail ?? email,
    loginEmail: email,
    fullName: profile?.full_name ?? lastOrder?.customer_name ?? null,
    phone: phoneE164,
    town: profile?.town ?? lastOrder?.town ?? null,
    address: lastOrder?.address ?? null,
  };
}

export function demoLogout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.session);
}

/**
 * Mirrors the real-mode deletion behavior (see /api/account/delete): removes
 * the profile + login credential, detaches (doesn't delete) past orders and
 * quote requests by nulling their user_id, drops per-user notifications, then
 * signs out. Order/quote records are kept for the same reason production
 * keeps them — they're business records, not identity data.
 */
export function demoDeleteAccount(): void {
  if (typeof window === "undefined") return;
  const session = getDemoSession();
  if (!session) return;
  const userId = session.user.id;
  const email = session.email.trim().toLowerCase();

  write(
    KEYS.profiles,
    read<Profile[]>(KEYS.profiles, []).filter((p) => p.id !== userId),
  );

  const creds = readCredentials();
  delete creds[email];
  write(KEYS.credentials, creds);

  write(
    KEYS.orders,
    read<Order[]>(KEYS.orders, DEMO_ORDERS).map((o) =>
      o.user_id === userId ? { ...o, user_id: null } : o,
    ),
  );
  write(
    KEYS.quoteRequests,
    read<QuoteRequest[]>(KEYS.quoteRequests, []).map((q) =>
      q.user_id === userId ? { ...q, user_id: null } : q,
    ),
  );
  write(
    KEYS.notifications,
    read<AppNotification[]>(KEYS.notifications, []).filter((n) => n.user_id !== userId),
  );

  localStorage.removeItem(KEYS.session);
}
