"use client";

import {
  DEMO_ADMIN,
  DEMO_CATEGORIES,
  DEMO_CUSTOMER,
  DEMO_DROPOFF_POINTS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_RIDER_USERS,
  DEMO_RIDERS,
  DEMO_SUPPLIER_ADDRESSES,
  DEMO_SUPPLIER_USERS,
  DEMO_SUPPLIERS,
} from "@/lib/demo-data";
import type {
  AppNotification,
  Category,
  DeliveryMethod,
  DropoffPoint,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  Profile,
  QuoteMarketAnalysis,
  QuoteRequest,
  RatingScores,
  RatingSubject,
  Rider,
  RiderDeliveryEvent,
  RiderDeliveryStatus,
  RiderPayout,
  ServiceRating,
  Supplier,
  SupplierAddress,
  SupplierAddressLabel,
  SupplyDispatchDetails,
  SupplyLogisticsPlan,
  SupplyRequest,
  SupplyRequestStatus,
  Town,
} from "@/lib/types";
import { buildHeuristicQuoteAnalysis } from "@/lib/quote-market-analysis";
import { averageScores } from "@/lib/ratings";
import type {
  EnsureCustomerAccountInput,
  EnsureCustomerAccountResult,
  GuestIdentityLookup,
} from "@/lib/auth/ensure-customer-account";
import { generateTemporaryPassword } from "@/lib/auth/password";
import {
  formatKes,
  PAY_NOW_DISCOUNT_RATE,
  QUOTE_DELIVERY_ESTIMATE_KES,
  RIDER_PAYOUT_KES,
  slugify,
  supplyRequestAgreed,
} from "@/lib/format";
import { matchSupplierProduct } from "@/lib/supplier-selection";
import {
  guestEmailFromPhone,
  isGuestPhoneEmail,
  normalizeKenyaPhone,
  phonesMatch,
} from "@/lib/phone";
import { buildInstantQuote, QUOTE_CATALOG_CATEGORY_SLUG } from "@/lib/quotes";

const KEYS = {
  products: "amg_products_v5",
  categories: "amg_categories",
  suppliers: "amg_suppliers_v2",
  orders: "amg_orders_v7",
  session: "amg_session",
  profiles: "amg_profiles_v6",
  /** email → password for demo-created customer accounts */
  credentials: "amg_credentials_v1",
  supplyRequests: "amg_supply_requests_v1",
  notifications: "amg_notifications_v1",
  riders: "amg_riders_v1",
  dropoffPoints: "amg_dropoff_points_v1",
  riderPayouts: "amg_rider_payouts_v1",
  quoteRequests: "amg_quote_requests_v1",
  supplierAddresses: "amg_supplier_addresses_v1",
  serviceRatings: "amg_service_ratings_v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(KEYS.products)) write(KEYS.products, DEMO_PRODUCTS);
  if (!localStorage.getItem(KEYS.categories)) write(KEYS.categories, DEMO_CATEGORIES);
  if (!localStorage.getItem(KEYS.suppliers)) write(KEYS.suppliers, DEMO_SUPPLIERS);
  if (!localStorage.getItem(KEYS.supplierAddresses)) {
    write(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  }
  if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, DEMO_ORDERS);
  if (!localStorage.getItem(KEYS.supplyRequests)) write(KEYS.supplyRequests, []);
  if (!localStorage.getItem(KEYS.notifications)) write(KEYS.notifications, []);
  if (!localStorage.getItem(KEYS.riders)) write(KEYS.riders, DEMO_RIDERS);
  if (!localStorage.getItem(KEYS.dropoffPoints)) write(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  if (!localStorage.getItem(KEYS.riderPayouts)) write(KEYS.riderPayouts, []);
  if (!localStorage.getItem(KEYS.quoteRequests)) write(KEYS.quoteRequests, []);
  if (!localStorage.getItem(KEYS.serviceRatings)) write(KEYS.serviceRatings, []);
  if (!localStorage.getItem(KEYS.profiles)) {
    write(KEYS.profiles, [
      DEMO_CUSTOMER,
      DEMO_ADMIN,
      ...DEMO_SUPPLIER_USERS,
      ...DEMO_RIDER_USERS,
    ]);
  }
  if (!localStorage.getItem(KEYS.credentials)) {
    write(KEYS.credentials, {
      "customer@amg.com": "customer123",
      "admin@amg.com": "admin123",
      "lakeview@amg.com": "supplier123",
      "ruma@amg.com": "supplier123",
      "migori@amg.com": "supplier123",
      "brian@amg.com": "rider123",
      "faith@amg.com": "rider123",
      "kevin@amg.com": "rider123",
    } satisfies Record<string, string>);
  }
}

function readCredentials(): Record<string, string> {
  ensureSeeded();
  return read<Record<string, string>>(KEYS.credentials, {});
}

function writeCredential(email: string, password: string) {
  const creds = readCredentials();
  write(KEYS.credentials, { ...creds, [email.trim().toLowerCase()]: password });
}

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

export function getDemoProducts(filters?: {
  categorySlug?: string;
  q?: string;
  town?: string;
  activeOnly?: boolean;
}): Product[] {
  ensureSeeded();
  let products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const categories = read<Category[]>(KEYS.categories, DEMO_CATEGORIES);

  if (filters?.activeOnly !== false) {
    products = products.filter((p) => p.is_active);
  }

  if (filters?.categorySlug) {
    const cat = categories.find((c) => c.slug === filters.categorySlug);
    if (cat) {
      const childIds = categories
        .filter((c) => c.parent_id === cat.id)
        .map((c) => c.id);
      const ids = new Set([cat.id, ...childIds]);
      products = products.filter((p) => ids.has(p.category_id));
    }
  }

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.short_description || p.description || "")
          .toLowerCase()
          .includes(q) ||
        (p.detailed_description || "").toLowerCase().includes(q),
    );
  }

  if (filters?.town) {
    products = products.filter((p) => p.towns.includes(filters.town as Town));
  }

  return products.map((p) => ({
    ...p,
    category: categories.find((c) => c.id === p.category_id),
  }));
}

export function getDemoProductBySlug(slug: string): Product | null {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const categories = read<Category[]>(KEYS.categories, DEMO_CATEGORIES);
  const suppliers = read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;
  return {
    ...product,
    category: categories.find((c) => c.id === product.category_id),
    supplier: suppliers.find((s) => s.id === product.supplier_id) ?? null,
  };
}

export function getDemoProductById(id: string): Product | null {
  ensureSeeded();
  return read<Product[]>(KEYS.products, DEMO_PRODUCTS).find((p) => p.id === id) ?? null;
}

export function getDemoCategories(): Category[] {
  ensureSeeded();
  return read<Category[]>(KEYS.categories, DEMO_CATEGORIES).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export function getDemoTopCategories(): Category[] {
  return getDemoCategories().filter((c) => !c.parent_id);
}

export function getDemoSuppliers(): Supplier[] {
  ensureSeeded();
  return read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
}

export function getDemoSupplierAddresses(supplierId?: string): SupplierAddress[] {
  ensureSeeded();
  const list = read<SupplierAddress[]>(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  const filtered = supplierId
    ? list.filter((a) => a.supplier_id === supplierId)
    : list;
  return filtered.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return +new Date(b.created_at) - +new Date(a.created_at);
  });
}

function syncSupplierTownFromDefault(supplierId: string) {
  const addresses = getDemoSupplierAddresses(supplierId);
  const def = addresses.find((a) => a.is_default) ?? addresses[0];
  if (!def) return;
  const suppliers = read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
  write(
    KEYS.suppliers,
    suppliers.map((s) =>
      s.id === supplierId ? { ...s, town: def.town } : s,
    ),
  );
}

export type SupplierAddressInput = {
  id?: string;
  supplier_id: string;
  label: SupplierAddressLabel;
  name: string;
  town: Town;
  line1: string;
  phone?: string | null;
  maps_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean;
};

export function upsertDemoSupplierAddress(input: SupplierAddressInput): SupplierAddress {
  ensureSeeded();
  const list = read<SupplierAddress[]>(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  const makeDefault = Boolean(input.is_default) || list.every((a) => a.supplier_id !== input.supplier_id);

  let next: SupplierAddress[];
  if (input.id) {
    const existing = list.find((a) => a.id === input.id);
    if (!existing || existing.supplier_id !== input.supplier_id) {
      throw new Error("Address not found");
    }
    const updated: SupplierAddress = {
      ...existing,
      label: input.label,
      name: input.name.trim(),
      town: input.town,
      line1: input.line1.trim(),
      phone: input.phone?.trim() || null,
      maps_url: input.maps_url?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      is_default: makeDefault ? true : existing.is_default,
    };
    next = list.map((a) => {
      if (a.id === updated.id) return updated;
      if (makeDefault && a.supplier_id === input.supplier_id) {
        return { ...a, is_default: false };
      }
      return a;
    });
  } else {
    const created: SupplierAddress = {
      id: `saddr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      supplier_id: input.supplier_id,
      label: input.label,
      name: input.name.trim(),
      town: input.town,
      line1: input.line1.trim(),
      phone: input.phone?.trim() || null,
      maps_url: input.maps_url?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      is_default: makeDefault,
      created_at: new Date().toISOString(),
    };
    next = list.map((a) =>
      makeDefault && a.supplier_id === input.supplier_id
        ? { ...a, is_default: false }
        : a,
    );
    next = [created, ...next];
  }

  write(KEYS.supplierAddresses, next);
  syncSupplierTownFromDefault(input.supplier_id);
  if (input.id) {
    return next.find((a) => a.id === input.id)!;
  }
  return next.find(
    (a) =>
      a.supplier_id === input.supplier_id &&
      a.name === input.name.trim() &&
      a.created_at === next[0]?.created_at,
  ) ?? next[0]!;
}

export function setDemoSupplierAddressDefault(
  addressId: string,
  supplierId: string,
): SupplierAddress | null {
  ensureSeeded();
  const list = read<SupplierAddress[]>(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  const target = list.find((a) => a.id === addressId && a.supplier_id === supplierId);
  if (!target) return null;
  const next = list.map((a) =>
    a.supplier_id === supplierId
      ? { ...a, is_default: a.id === addressId }
      : a,
  );
  write(KEYS.supplierAddresses, next);
  syncSupplierTownFromDefault(supplierId);
  return next.find((a) => a.id === addressId) ?? null;
}

export function deleteDemoSupplierAddress(
  addressId: string,
  supplierId: string,
): void {
  ensureSeeded();
  const list = read<SupplierAddress[]>(KEYS.supplierAddresses, DEMO_SUPPLIER_ADDRESSES);
  const remaining = list.filter(
    (a) => !(a.id === addressId && a.supplier_id === supplierId),
  );
  const mine = remaining.filter((a) => a.supplier_id === supplierId);
  if (mine.length > 0 && !mine.some((a) => a.is_default)) {
    const first = mine[0];
    write(
      KEYS.supplierAddresses,
      remaining.map((a) =>
        a.id === first.id ? { ...a, is_default: true } : a,
      ),
    );
  } else {
    write(KEYS.supplierAddresses, remaining);
  }
  syncSupplierTownFromDefault(supplierId);
}

export function getDemoOrders(userId?: string): Order[] {
  ensureSeeded();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const filtered = userId ? orders.filter((o) => o.user_id === userId) : orders;
  return filtered.sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export function getDemoOrder(id: string): Order | null {
  ensureSeeded();
  return read<Order[]>(KEYS.orders, DEMO_ORDERS).find((o) => o.id === id) ?? null;
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

function patchDemoProfile(
  profileId: string,
  patch: Partial<Pick<Profile, "full_name" | "phone" | "town">>,
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

export function createDemoOrder(input: {
  user_id: string | null;
  customer_name: string;
  phone: string;
  email?: string | null;
  town: Town;
  address: string;
  payment_method: PaymentMethod;
  mpesa_phone: string | null;
  /** True when payment was actually confirmed online (M-Pesa pay-now) before submit. */
  paid: boolean;
  delivery_method: DeliveryMethod;
  dropoff_point_id?: string | null;
  items: { productId: string; name: string; price_kes: number; qty: number }[];
}): Order {
  ensureSeeded();
  const id = `ord-${Date.now()}`;
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const suppliers = read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
  const items: OrderItem[] = input.items.map((item, i) => {
    const product = products.find((p) => p.id === item.productId);
    const supplier = suppliers.find((s) => s.id === product?.supplier_id);
    return {
      id: `${id}-i${i}`,
      order_id: id,
      product_id: item.productId,
      name_snapshot: item.name,
      price_kes: item.price_kes,
      qty: item.qty,
      supplier_id: product?.supplier_id ?? null,
      supplier_name_snapshot: supplier?.name ?? null,
    };
  });
  const subtotal_kes = items.reduce((sum, i) => sum + i.price_kes * i.qty, 0);
  const discount_kes = input.paid ? Math.round(subtotal_kes * PAY_NOW_DISCOUNT_RATE) : 0;
  const total_kes = subtotal_kes - discount_kes;
  const dropoffPoints = read<DropoffPoint[]>(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  const dropoff =
    input.delivery_method === "dropoff"
      ? dropoffPoints.find((d) => d.id === input.dropoff_point_id) ?? null
      : null;

  const order: Order = {
    id,
    user_id: input.user_id,
    customer_name: input.customer_name,
    phone: input.phone,
    email: input.email ?? null,
    town: input.town,
    address: input.address,
    payment_method: input.payment_method,
    mpesa_phone: input.mpesa_phone,
    paid: input.paid,
    paid_at: input.paid ? new Date().toISOString() : null,
    subtotal_kes,
    discount_kes,
    delivery_method: input.delivery_method,
    dropoff_point_id: dropoff?.id ?? null,
    dropoff_point_name: dropoff?.name ?? null,
    rider_id: null,
    rider_name_snapshot: null,
    delivered_at: null,
    status: "pending",
    total_kes,
    created_at: new Date().toISOString(),
    buyer_notified_at: null,
    items,
  };
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  write(KEYS.orders, [order, ...orders]);

  const updated = products.map((p) => {
    const line = input.items.find((i) => i.productId === p.id);
    if (!line) return p;
    return { ...p, stock: Math.max(0, p.stock - line.qty) };
  });
  write(KEYS.products, updated);

  const paidNote = input.paid
    ? ` Paid online (5% discount applied, ${formatKes(discount_kes)} off).`
    : " Cash on delivery.";
  pushNotification({
    user_id: "demo-admin",
    title: "New customer order",
    body: `${order.customer_name} placed an order for ${formatKes(total_kes)}.${paidNote} Forward items to suppliers.`,
    link: "/admin/orders",
    order_id: order.id,
  });

  return order;
}

export function updateDemoOrderStatus(id: string, status: Order["status"]): Order | null {
  ensureSeeded();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) => (o.id === id ? { ...o, status } : o));
  write(KEYS.orders, next);
  return next.find((o) => o.id === id) ?? null;
}

export function upsertDemoProduct(
  data: Partial<Product> & { name: string; category_id: string; price_kes: number },
): Product {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  if (data.id) {
    const next = products.map((p) =>
      p.id === data.id
        ? {
            ...p,
            ...data,
            slug: data.slug || p.slug,
          }
        : p,
    );
    write(KEYS.products, next);
    return next.find((p) => p.id === data.id)!;
  }
  const short = data.short_description || data.description || "";
  const product: Product = {
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category_id: data.category_id,
    supplier_id: data.supplier_id ?? null,
    name: data.name,
    slug: data.slug || slugify(data.name),
    short_description: short,
    detailed_description: data.detailed_description || short,
    description: short,
    price_kes: data.price_kes,
    stock: data.stock ?? 0,
    image_path: data.image_path ?? null,
    gallery: data.gallery ?? [],
    barcode: data.barcode ?? null,
    towns: data.towns ?? ["Homabay"],
    is_active: data.is_active ?? true,
    created_at: new Date().toISOString(),
  };
  write(KEYS.products, [product, ...products]);
  return product;
}

/** Set absolute stock for a product. Optionally enforce supplier ownership. */
export function adjustDemoProductStock(
  productId: string,
  stock: number,
  supplierId?: string,
): Product | null {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  if (supplierId && product.supplier_id !== supplierId) return null;
  const nextStock = Math.max(0, Math.round(stock));
  const next = products.map((p) =>
    p.id === productId ? { ...p, stock: nextStock } : p,
  );
  write(KEYS.products, next);
  return next.find((p) => p.id === productId) ?? null;
}

/** Toggle or set active flag; optional supplier ownership check. */
export function setDemoProductActive(
  productId: string,
  isActive: boolean,
  supplierId?: string,
): Product | null {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  if (supplierId && product.supplier_id !== supplierId) return null;
  const next = products.map((p) =>
    p.id === productId ? { ...p, is_active: isActive } : p,
  );
  write(KEYS.products, next);
  return next.find((p) => p.id === productId) ?? null;
}

export function deleteDemoProduct(id: string) {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  write(
    KEYS.products,
    products.map((p) => (p.id === id ? { ...p, is_active: false } : p)),
  );
}

export function upsertDemoSupplier(
  data: Partial<Supplier> & { name: string },
): Supplier {
  ensureSeeded();
  const suppliers = read<Supplier[]>(KEYS.suppliers, DEMO_SUPPLIERS);
  if (data.id) {
    const next = suppliers.map((s) => (s.id === data.id ? { ...s, ...data } : s));
    write(KEYS.suppliers, next);
    return next.find((s) => s.id === data.id)!;
  }
  const supplier: Supplier = {
    id: `sup-${Date.now()}`,
    name: data.name,
    contact_phone: data.contact_phone ?? null,
    town: data.town ?? null,
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  };
  write(KEYS.suppliers, [supplier, ...suppliers]);
  return supplier;
}

export function upsertDemoCategory(
  data: Partial<Category> & { name: string },
): Category {
  ensureSeeded();
  const categories = read<Category[]>(KEYS.categories, DEMO_CATEGORIES);
  if (data.id) {
    const next = categories.map((c) =>
      c.id === data.id ? { ...c, ...data, slug: data.slug || c.slug } : c,
    );
    write(KEYS.categories, next);
    return next.find((c) => c.id === data.id)!;
  }
  const category: Category = {
    id: `cat-${Date.now()}`,
    name: data.name,
    slug: data.slug || slugify(data.name),
    parent_id: data.parent_id ?? null,
    sort_order: data.sort_order ?? categories.length + 1,
    description: data.description ?? null,
  };
  write(KEYS.categories, [...categories, category]);
  return category;
}

function pushNotification(input: {
  user_id: string;
  title: string;
  body: string;
  link?: string | null;
  order_id?: string | null;
  supply_request_id?: string | null;
}) {
  ensureSeeded();
  const note: AppNotification = {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    read: false,
    created_at: new Date().toISOString(),
    order_id: input.order_id ?? null,
    supply_request_id: input.supply_request_id ?? null,
  };
  const list = read<AppNotification[]>(KEYS.notifications, []);
  write(KEYS.notifications, [note, ...list]);
  return note;
}

export function getDemoNotifications(userId: string): AppNotification[] {
  ensureSeeded();
  return read<AppNotification[]>(KEYS.notifications, [])
    .filter((n) => n.user_id === userId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function markDemoNotificationRead(id: string) {
  ensureSeeded();
  const list = read<AppNotification[]>(KEYS.notifications, []);
  write(
    KEYS.notifications,
    list.map((n) => (n.id === id ? { ...n, read: true } : n)),
  );
}

function normalizeSupplyRequest(r: SupplyRequest): SupplyRequest {
  return {
    ...r,
    logistics: r.logistics ?? null,
    dispatch: r.dispatch ?? null,
    dispatched_at: r.dispatched_at ?? null,
    fulfilled_at: r.fulfilled_at ?? null,
    fulfilled_by: r.fulfilled_by ?? null,
  };
}

export function getDemoSupplyRequests(filters?: {
  supplierId?: string;
  orderId?: string;
}): SupplyRequest[] {
  ensureSeeded();
  let list = read<SupplyRequest[]>(KEYS.supplyRequests, []).map(normalizeSupplyRequest);
  if (filters?.supplierId) {
    list = list.filter((r) => r.supplier_id === filters.supplierId);
  }
  if (filters?.orderId) {
    list = list.filter((r) => r.order_id === filters.orderId);
  }
  return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoSupplyRequest(id: string): SupplyRequest | null {
  ensureSeeded();
  const found = read<SupplyRequest[]>(KEYS.supplyRequests, []).find((r) => r.id === id);
  return found ? normalizeSupplyRequest(found) : null;
}

/** Admin: forward a supplier's portion of an order */
export function requestSupplyFromSupplier(
  orderId: string,
  supplierId: string,
): SupplyRequest {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const suppliers = getDemoSuppliers();
  const supplier = suppliers.find((s) => s.id === supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const existing = getDemoSupplyRequests({ orderId, supplierId })[0];
  if (existing) return existing;

  const lines = (order.items ?? []).filter((i) => i.supplier_id === supplierId);
  if (lines.length === 0) throw new Error("No items for this supplier");

  const request: SupplyRequest = {
    id: `sr-${Date.now()}`,
    order_id: orderId,
    supplier_id: supplierId,
    supplier_name: supplier.name,
    status: "pending",
    items: lines.map((i) => ({
      order_item_id: i.id,
      product_id: i.product_id,
      name: i.name_snapshot,
      qty: i.qty,
      price_kes: i.price_kes,
    })),
    total_kes: lines.reduce((s, i) => s + i.price_kes * i.qty, 0),
    customer_town: order.town,
    delivery_note: `Supply to AMG.COM client in ${order.town}. AMG will handle final dispatch.`,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    logistics: null,
    dispatch: null,
    dispatched_at: null,
    fulfilled_at: null,
    fulfilled_by: null,
  };

  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(KEYS.supplyRequests, [request, ...list]);
  updateDemoOrderStatus(orderId, "awaiting_supplier");

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === supplierId,
  );
  if (supplierUser) {
    const itemSummary = request.items
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");
    pushNotification({
      user_id: supplierUser.id,
      title: "New supply request from AMG.COM",
      body: `Please supply ${itemSummary}. Total ${formatKes(request.total_kes)} for AMG's client in ${order.town}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: orderId,
      supply_request_id: request.id,
    });
  }

  return request;
}

/**
 * Admin: after comparative analysis, assign matched lines to the chosen supplier
 * and create a supply request (reassigns product/price snapshots when substituting).
 */
export function fulfillOrderWithSupplier(
  orderId: string,
  supplierId: string,
): SupplyRequest {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const supplier = getDemoSuppliers().find((s) => s.id === supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const existing = getDemoSupplyRequests({ orderId, supplierId })[0];
  if (existing) return existing;

  const products = getDemoProducts({ activeOnly: false });
  const catalogById = new Map(products.map((p) => [p.id, p]));
  const theirs = products.filter((p) => p.supplier_id === supplierId);
  const covered = (order.items ?? [])
    .map((item) => {
      const product = matchSupplierProduct(item, theirs, catalogById, supplierId);
      if (!product || product.stock < 1) return null;
      // Rival synthetic offers use id suffix __offer__ — keep the real catalog product id
      const productId = product.id.includes("__offer__")
        ? product.id.split("__offer__")[0]
        : product.id;
      return { item, product, productId };
    })
    .filter((m): m is { item: OrderItem; product: Product; productId: string } => Boolean(m));
  if (covered.length === 0) throw new Error("No stock available from this supplier");

  const coveredIds = new Set(covered.map((m) => m.item.id));
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const nextOrders = orders.map((o) => {
    if (o.id !== orderId) return o;
    const items = (o.items ?? []).map((item) => {
      const match = covered.find((m) => m.item.id === item.id);
      if (!match) return item;
      return {
        ...item,
        product_id: match.productId,
        name_snapshot: match.product.name,
        price_kes: match.product.price_kes,
        supplier_id: supplier.id,
        supplier_name_snapshot: supplier.name,
      };
    });
    const subtotal_kes = items.reduce((s, i) => s + i.price_kes * i.qty, 0);
    const discount_kes = o.paid ? Math.round(subtotal_kes * PAY_NOW_DISCOUNT_RATE) : o.discount_kes;
    return {
      ...o,
      items,
      subtotal_kes,
      discount_kes,
      total_kes: subtotal_kes - discount_kes,
    };
  });
  write(KEYS.orders, nextOrders);

  // Prefer remapped lines; fall back to classic filter after write
  const refreshed = getDemoOrder(orderId);
  const lines = (refreshed?.items ?? []).filter(
    (i) => i.supplier_id === supplierId && coveredIds.has(i.id),
  );
  if (lines.length === 0) throw new Error("No items for this supplier after matching");

  const request: SupplyRequest = {
    id: `sr-${Date.now()}`,
    order_id: orderId,
    supplier_id: supplierId,
    supplier_name: supplier.name,
    status: "pending",
    items: lines.map((i) => ({
      order_item_id: i.id,
      product_id: i.product_id,
      name: i.name_snapshot,
      qty: i.qty,
      price_kes: i.price_kes,
    })),
    total_kes: lines.reduce((s, i) => s + i.price_kes * i.qty, 0),
    customer_town: order.town,
    delivery_note: `Supply to AMG.COM client in ${order.town}. Selected via value-for-money analysis. AMG will handle final dispatch.`,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    logistics: null,
    dispatch: null,
    dispatched_at: null,
    fulfilled_at: null,
    fulfilled_by: null,
  };

  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(KEYS.supplyRequests, [request, ...list]);
  updateDemoOrderStatus(orderId, "awaiting_supplier");

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === supplierId,
  );
  if (supplierUser) {
    const itemSummary = request.items
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");
    pushNotification({
      user_id: supplierUser.id,
      title: "New supply request from AMG.COM",
      body: `Please supply ${itemSummary}. Total ${formatKes(request.total_kes)} for AMG's client in ${order.town}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: orderId,
      supply_request_id: request.id,
    });
  }

  return request;
}

function writeSupplyRequest(updated: SupplyRequest): SupplyRequest {
  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  write(
    KEYS.supplyRequests,
    list.map((r) => (r.id === updated.id ? updated : r)),
  );
  return updated;
}

function refreshOrderSupplierStatus(orderId: string) {
  const orderRequests = getDemoSupplyRequests({ orderId });
  const order = getDemoOrder(orderId);
  const assignedIds = new Set(
    (order?.items ?? [])
      .map((i) => i.supplier_id)
      .filter((id): id is string => Boolean(id)),
  );
  const allAgreed = Array.from(assignedIds).every((sid) =>
    orderRequests.some((r) => r.supplier_id === sid && supplyRequestAgreed(r.status)),
  );
  if (allAgreed && order && (order.status === "pending" || order.status === "awaiting_supplier")) {
    updateDemoOrderStatus(orderId, "supplier_confirmed");
  }
}

/** Supplier confirms they will supply and files the inbound logistics plan to AMG. */
export function confirmDemoSupplyRequest(
  requestId: string,
  logistics: SupplyLogisticsPlan,
): SupplyRequest {
  ensureSeeded();
  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  const request = list.find((r) => r.id === requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status === "dispatched" || request.status === "fulfilled") {
    throw new Error("This request can no longer be confirmed");
  }
  if (request.status === "rejected") {
    // allow re-confirm from rejected
  } else if (request.status !== "pending" && request.status !== "confirmed") {
    throw new Error("This request can no longer be confirmed");
  }
  if (!logistics.amg_location_id || !logistics.planned_dispatch_at || !logistics.method) {
    throw new Error("Logistics plan is incomplete");
  }
  if (Number.isNaN(Date.parse(logistics.planned_dispatch_at))) {
    throw new Error("Planned dispatch time is invalid");
  }

  const wasPending = request.status === "pending" || request.status === "rejected";
  const updated = writeSupplyRequest({
    ...request,
    status: "confirmed",
    confirmed_at: request.confirmed_at ?? new Date().toISOString(),
    logistics,
  });

  if (wasPending) {
    refreshOrderSupplierStatus(request.order_id);
    pushNotification({
      user_id: "demo-admin",
      title: `${request.supplier_name} confirmed supply`,
      body: `Order ${request.order_id}: logistics plan set — ${logistics.method} to ${logistics.amg_location_name} on ${new Date(logistics.planned_dispatch_at).toLocaleString()}.`,
      link: "/admin/orders",
      order_id: request.order_id,
      supply_request_id: request.id,
    });
  }

  return updated;
}

/** Supplier marks stock as dispatched toward the AMG hub with driver/vehicle details. */
export function dispatchDemoSupplyRequest(
  requestId: string,
  dispatch: SupplyDispatchDetails,
): SupplyRequest {
  ensureSeeded();
  const request = getDemoSupplyRequest(requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status !== "confirmed") {
    throw new Error("Only confirmed orders can be marked dispatched");
  }
  if (!request.logistics) {
    throw new Error(
      "Logistics plan missing — drag back to add the AMG hub plan, or open the order and save logistics first.",
    );
  }
  if (!dispatch.driver_name.trim() || !dispatch.driver_phone.trim() || !dispatch.vehicle_plate.trim()) {
    throw new Error("Driver name, phone, and vehicle plate are required");
  }

  const cleaned: SupplyDispatchDetails = {
    vehicle_type: dispatch.vehicle_type,
    driver_name: dispatch.driver_name.trim(),
    driver_phone: dispatch.driver_phone.trim(),
    vehicle_plate: dispatch.vehicle_plate.trim().toUpperCase(),
    vehicle_description: dispatch.vehicle_description?.trim() || null,
  };

  const updated = writeSupplyRequest({
    ...request,
    status: "dispatched",
    dispatch: cleaned,
    dispatched_at: new Date().toISOString(),
  });

  pushNotification({
    user_id: "demo-admin",
    title: `${request.supplier_name} dispatched to AMG`,
    body: `Order ${request.order_id}: ${cleaned.vehicle_type.toUpperCase()} ${cleaned.vehicle_plate}, driver ${cleaned.driver_name} (${cleaned.driver_phone}) → ${request.logistics.amg_location_name}.`,
    link: "/admin/orders",
    order_id: request.order_id,
    supply_request_id: request.id,
  });

  return updated;
}

/** AMG admin certifies inbound goods after inspection (supplier cannot do this). */
export function fulfillDemoSupplyRequest(
  requestId: string,
  adminUserId = "demo-admin",
): SupplyRequest {
  ensureSeeded();
  const request = getDemoSupplyRequest(requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status !== "dispatched") {
    throw new Error("Only dispatched supply can be certified fulfilled");
  }

  const updated = writeSupplyRequest({
    ...request,
    status: "fulfilled",
    fulfilled_at: new Date().toISOString(),
    fulfilled_by: adminUserId,
  });

  const supplierUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "supplier" && p.supplier_id === request.supplier_id,
  );
  if (supplierUser) {
    pushNotification({
      user_id: supplierUser.id,
      title: "AMG certified your delivery",
      body: `Supply for order ${request.order_id} was inspected and marked fulfilled at ${request.logistics?.amg_location_name ?? "AMG hub"}.`,
      link: `/supplier/requests/${request.id}`,
      order_id: request.order_id,
      supply_request_id: request.id,
    });
  }

  return updated;
}

/**
 * Kanban advance for suppliers: pending→confirmed needs logistics (use confirm),
 * confirmed→dispatched. Fulfilled is AMG-only.
 */
export function advanceDemoSupplyRequest(
  requestId: string,
  to: SupplyRequestStatus,
  logistics?: SupplyLogisticsPlan,
  dispatch?: SupplyDispatchDetails,
): SupplyRequest {
  if (to === "confirmed") {
    if (!logistics) throw new Error("Logistics plan required to confirm");
    return confirmDemoSupplyRequest(requestId, logistics);
  }
  if (to === "dispatched") {
    if (!dispatch) throw new Error("Driver and vehicle details required to dispatch");
    return dispatchDemoSupplyRequest(requestId, dispatch);
  }
  if (to === "fulfilled") {
    throw new Error("Only AMG can certify fulfilled after inspection");
  }
  throw new Error(`Cannot move supply request to ${to}`);
}

/** Admin confirms order to the buyer after supplier confirmations */
export function confirmOrderToBuyer(orderId: string): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "confirmed" as const,
          buyer_notified_at: new Date().toISOString(),
        }
      : o,
  );
  write(KEYS.orders, next);

  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Your AMG.COM order is confirmed",
      body: `Order ${orderId} is confirmed. We will dispatch soon to ${order.town}.`,
      link: `/order/${orderId}`,
      order_id: orderId,
    });
  }

  return next.find((o) => o.id === orderId)!;
}

export function dispatchDemoOrder(orderId: string, riderId: string): Order | null {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS);
  const rider = riders.find((r) => r.id === riderId);
  if (!rider) throw new Error("Rider not found");

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const assignedAt = new Date().toISOString();
  const assignEvent: RiderDeliveryEvent = {
    status: "assigned",
    at: assignedAt,
    note: `Assigned to ${rider.name}`,
  };
  const next = orders.map((o) => {
    if (o.id !== orderId) return o;
    const prevEvents = o.rider_delivery_events ?? [];
    return {
      ...o,
      status: "out_for_delivery" as const,
      rider_id: rider.id,
      rider_name_snapshot: rider.name,
      rider_vehicle_snapshot: rider.vehicle,
      rider_delivery_status: "assigned" as const,
      rider_fail_reason: null,
      rider_delivery_events: [...prevEvents, assignEvent],
    };
  });
  write(KEYS.orders, next);
  const order = next.find((o) => o.id === orderId) ?? null;

  const riderUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "rider" && p.rider_id === rider.id,
  );
  if (riderUser && order) {
    pushNotification({
      user_id: riderUser.id,
      title: "New delivery assigned",
      body: `Order ${shortId(order.id)} to ${order.town}${
        order.delivery_method === "dropoff" && order.dropoff_point_name
          ? ` (drop-off: ${order.dropoff_point_name})`
          : " (deliver to doorstep)"
      }.`,
      link: "/rider",
      order_id: order.id,
    });
  }

  if (order) {
    notifyRiderStageToCustomerAndAdmin(order, "assigned");
  }

  return order;
}

function riderStageMessage(
  order: Order,
  status: RiderDeliveryStatus,
): { customerTitle: string; customerBody: string; adminTitle: string; adminBody: string } {
  const rider = order.rider_name_snapshot || "Rider";
  const ref = shortId(order.id);
  const map: Record<
    RiderDeliveryStatus,
    { customerTitle: string; customerBody: string; adminTitle: string; adminBody: string }
  > = {
    assigned: {
      customerTitle: "Rider assigned to your order",
      customerBody: `${rider} will deliver order ${ref} to you in ${order.town}.`,
      adminTitle: `Rider assigned — ${rider}`,
      adminBody: `${rider} assigned to order ${ref} (${order.customer_name}, ${order.town}).`,
    },
    collected: {
      customerTitle: "Rider collected your order",
      customerBody: `${rider} collected order ${ref} from the AMG hub and will head out shortly.`,
      adminTitle: `Collected for delivery — ${rider}`,
      adminBody: `${rider} collected order ${ref} from hub.`,
    },
    in_transit: {
      customerTitle: "Your order is in transit",
      customerBody: `${rider} is on the way with order ${ref}.`,
      adminTitle: `In transit — ${rider}`,
      adminBody: `${rider} is in transit with order ${ref} to ${order.customer_name}.`,
    },
    delivered: {
      customerTitle: "Order delivered",
      customerBody: `${rider} handed over order ${ref}. Complete payment with the rider if still unpaid.`,
      adminTitle: `Delivered — ${rider}`,
      adminBody: `${rider} marked order ${ref} delivered${order.paid ? "" : " (payment pending)"}.`,
    },
    paid: {
      customerTitle: "Payment received — delivery complete",
      customerBody: `Payment for order ${ref} is registered. Thank you for shopping with AMG.COM.`,
      adminTitle: `Paid — trip closed`,
      adminBody: `Order ${ref} paid and closed by ${rider}.`,
    },
    failed: {
      customerTitle: "Delivery could not be completed",
      customerBody: `${rider} could not complete delivery for order ${ref}${
        order.rider_fail_reason ? `: ${order.rider_fail_reason}` : ""
      }. AMG will contact you.`,
      adminTitle: `Fail delivery — ${rider}`,
      adminBody: `${rider} failed order ${ref}${
        order.rider_fail_reason ? `: ${order.rider_fail_reason}` : ""
      }.`,
    },
  };
  return map[status];
}

function notifyRiderStageToCustomerAndAdmin(
  order: Order,
  status: RiderDeliveryStatus,
) {
  const msg = riderStageMessage(order, status);
  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: msg.customerTitle,
      body: msg.customerBody,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }
  pushNotification({
    user_id: "demo-admin",
    title: msg.adminTitle,
    body: msg.adminBody,
    link: "/admin/orders",
    order_id: order.id,
  });
}

/** Resolve the portal user id linked to a rider record (for push / in-app alerts). */
export function getDemoUserIdForRider(riderId: string): string | null {
  ensureSeeded();
  return (
    read<Profile[]>(KEYS.profiles, []).find(
      (p) => p.role === "rider" && p.rider_id === riderId,
    )?.id ?? null
  );
}

/**
 * Rider registers payment before leaving the customer.
 * COD = cash collected; mpesa = STK confirmed at the door.
 */
/** In-app alert to the customer when the rider sends a door-side M-Pesa STK. */
export function notifyDemoDoorMpesaPrompt(orderId: string, phone: string): void {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order?.user_id) return;
  pushNotification({
    user_id: order.user_id,
    title: "Confirm M-Pesa on your phone",
    body: `AMG rider sent a payment request for ${formatKes(Number(order.total_kes))} to ${phone}. Enter your M-Pesa PIN — the rider will wait until it confirms.`,
    link: `/order/${order.id}`,
    order_id: order.id,
  });
}

export function markDemoOrderPaid(
  orderId: string,
  input: {
    method: PaymentMethod;
    note?: string | null;
    mpesa_phone?: string | null;
  },
): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (
    order.status !== "out_for_delivery" &&
    order.status !== "confirmed" &&
    order.status !== "delivered"
  ) {
    throw new Error("Only orders in delivery can be marked paid here");
  }
  if (order.paid) {
    if (normalizeRiderDeliveryStatus(order) === "delivered") {
      return setDemoRiderDeliveryStatus(orderId, "paid");
    }
    return order;
  }

  const paidAt = new Date().toISOString();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const stage = normalizeRiderDeliveryStatus(order);
  const closeTrip = stage === "delivered" || stage === "paid";
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          paid: true,
          paid_at: paidAt,
          payment_method: input.method,
          mpesa_phone:
            input.method === "mpesa"
              ? input.mpesa_phone || o.mpesa_phone || o.phone
              : o.mpesa_phone,
        }
      : o,
  );
  write(KEYS.orders, next);

  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Payment received",
      body: `Payment of ${formatKes(Number(order.total_kes))} for order ${shortId(order.id)} was registered (${input.method === "mpesa" ? "M-Pesa" : "cash"}).`,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }

  // Goods already handed over → close on Paid column (events + admin/customer stage notice)
  if (closeTrip && order.rider_id) {
    return setDemoRiderDeliveryStatus(orderId, "paid");
  }

  if (order.rider_id) {
    const riderUserId = getDemoUserIdForRider(order.rider_id);
    if (riderUserId) {
      pushNotification({
        user_id: riderUserId,
        title: "Payment registered",
        body: `Order ${shortId(order.id)} is paid. Move it to Delivered / Paid when goods are handed over.`,
        link: "/rider",
        order_id: order.id,
      });
    }
  }

  return getDemoOrder(orderId)!;
}

/** Infer kanban column for legacy orders missing rider_delivery_status. */
export function normalizeRiderDeliveryStatus(order: Order): RiderDeliveryStatus {
  if (order.rider_delivery_status) return order.rider_delivery_status;
  if (order.status === "delivered") return order.paid ? "paid" : "delivered";
  if (order.status === "out_for_delivery") return "assigned";
  return "assigned";
}

function ensureRiderPayout(order: Order, at: string): RiderPayout | null {
  if (!order.rider_id) return null;
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  const existing = payouts.find((p) => p.order_id === order.id);
  if (existing) return existing;
  const payout: RiderPayout = {
    id: `payout-${Date.now()}`,
    order_id: order.id,
    rider_id: order.rider_id,
    rider_name: order.rider_name_snapshot ?? "Rider",
    amount_kes: RIDER_PAYOUT_KES,
    status: "sent",
    created_at: at,
  };
  write(KEYS.riderPayouts, [payout, ...payouts]);
  const riderUser = read<Profile[]>(KEYS.profiles, []).find(
    (p) => p.role === "rider" && p.rider_id === order.rider_id,
  );
  if (riderUser) {
    pushNotification({
      user_id: riderUser.id,
      title: "Delivery payment sent",
      body: `Payment of ${formatKes(RIDER_PAYOUT_KES)} sent for order ${shortId(order.id)}.`,
      link: "/rider",
      order_id: order.id,
    });
  }
  return payout;
}

/** Close trip after payment on the Paid column (payout + customer notice). */
function finalizeRiderPaidDelivery(orderId: string): {
  order: Order;
  payout: RiderPayout | null;
} {
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  const at = order.delivered_at || new Date().toISOString();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "delivered" as const,
          delivered_at: o.delivered_at || at,
          rider_delivery_status: "paid" as const,
        }
      : o,
  );
  write(KEYS.orders, next);
  const updated = next.find((o) => o.id === orderId)!;
  const payout = order.paid ? ensureRiderPayout(updated, at) : null;
  return { order: updated, payout };
}

/**
 * Advance (or set) the rider kanban stage.
 * Paid requires order.paid === true. Failed accepts an optional reason.
 */
export function setDemoRiderDeliveryStatus(
  orderId: string,
  to: RiderDeliveryStatus,
  opts?: { failReason?: string | null },
): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.rider_id) throw new Error("Order is not assigned to a rider");

  if (to === "paid" && !order.paid) {
    throw new Error("Collect M-Pesa or cash before moving to Paid");
  }

  const current = normalizeRiderDeliveryStatus(order);
  if (current === to && to !== "failed") {
    return order;
  }

  const now = new Date().toISOString();
  const failReason =
    to === "failed" ? opts?.failReason?.trim() || "Delivery failed" : null;
  const event: RiderDeliveryEvent = {
    status: to,
    at: now,
    note:
      to === "failed"
        ? failReason
        : to === "assigned"
          ? `Assigned to ${order.rider_name_snapshot || "rider"}`
          : null,
  };

  let patch: Partial<Order> = {
    rider_delivery_status: to,
    rider_fail_reason: failReason,
    rider_delivery_events: [...(order.rider_delivery_events ?? []), event],
  };

  if (to === "delivered" || to === "paid") {
    patch = {
      ...patch,
      status: "delivered",
      delivered_at: order.delivered_at || now,
    };
  } else if (to === "failed") {
    patch = {
      ...patch,
      status: "out_for_delivery",
    };
  } else {
    patch = {
      ...patch,
      status: "out_for_delivery",
      delivered_at: null,
    };
  }

  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  write(
    KEYS.orders,
    orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
  );

  let updated = getDemoOrder(orderId)!;

  if (to === "paid") {
    updated = finalizeRiderPaidDelivery(orderId).order;
  }

  notifyRiderStageToCustomerAndAdmin(updated, to);
  return updated;
}

/** @deprecated Prefer setDemoRiderDeliveryStatus — kept for admin/order-status paths. */
export function deliverDemoOrder(orderId: string): { order: Order; payout: RiderPayout | null } {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.paid) {
    throw new Error(
      "Payment not registered. Collect cash or confirm M-Pesa before closing as Paid.",
    );
  }
  setDemoRiderDeliveryStatus(orderId, "delivered");
  const closed = setDemoRiderDeliveryStatus(orderId, "paid");
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  return {
    order: closed,
    payout: payouts.find((p) => p.order_id === orderId) ?? null,
  };
}

/**
 * Admin records that the supplier has responded (agreed).
 * Confirms any pending supply requests with a stub logistics plan and
 * moves the order to supplier_confirmed.
 */
export function adminRecordSupplierResponse(orderId: string): Order {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");

  const pending = getDemoSupplyRequests({ orderId }).filter((r) => r.status === "pending");
  const hubs = getDemoDropoffPoints(order.town);
  const hub = hubs[0];
  const stubLogistics: SupplyLogisticsPlan = {
    method: "boda",
    amg_location_id: hub?.id ?? "drop-homabay-1",
    amg_location_name: hub?.name ?? "AMG Hub",
    amg_location_town: hub?.town ?? order.town,
    planned_dispatch_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
    notes: "Recorded by AMG admin from Order Status board",
  };

  for (const req of pending) {
    confirmDemoSupplyRequest(req.id, stubLogistics);
  }

  updateDemoOrderStatus(orderId, "supplier_confirmed");
  return getDemoOrder(orderId)!;
}

export function getDemoServiceRatings(orderId?: string): ServiceRating[] {
  ensureSeeded();
  const list = read<ServiceRating[]>(KEYS.serviceRatings, []);
  const filtered = orderId ? list.filter((r) => r.order_id === orderId) : list;
  return filtered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function upsertDemoServiceRating(input: {
  id?: string;
  order_id: string;
  subject: RatingSubject;
  scores: RatingScores;
  notes?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  rider_id?: string | null;
  rider_name?: string | null;
  created_by?: string | null;
}): ServiceRating {
  ensureSeeded();
  const list = read<ServiceRating[]>(KEYS.serviceRatings, []);
  const average = averageScores(input.scores);

  if (input.id) {
    const next = list.map((r) =>
      r.id === input.id
        ? {
            ...r,
            scores: input.scores,
            average,
            notes: input.notes?.trim() || null,
            supplier_id: input.supplier_id ?? r.supplier_id,
            supplier_name: input.supplier_name ?? r.supplier_name,
            rider_id: input.rider_id ?? r.rider_id,
            rider_name: input.rider_name ?? r.rider_name,
          }
        : r,
    );
    write(KEYS.serviceRatings, next);
    return next.find((r) => r.id === input.id)!;
  }

  // One rating per subject per order — replace if exists
  const without = list.filter(
    (r) => !(r.order_id === input.order_id && r.subject === input.subject),
  );
  const rating: ServiceRating = {
    id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    order_id: input.order_id,
    subject: input.subject,
    supplier_id: input.supplier_id ?? null,
    supplier_name: input.supplier_name ?? null,
    rider_id: input.rider_id ?? null,
    rider_name: input.rider_name ?? null,
    scores: input.scores,
    average,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    created_by: input.created_by ?? null,
  };
  write(KEYS.serviceRatings, [rating, ...without]);
  return rating;
}

function shortId(id: string): string {
  return id.startsWith("ord-") ? id.slice(0, 12) : id.slice(0, 8).toUpperCase();
}

export function getDemoProductsBySupplier(supplierId: string): Product[] {
  ensureSeeded();
  return getDemoProducts({ activeOnly: false }).filter(
    (p) => p.supplier_id === supplierId,
  );
}

export function getDemoRiders(town?: Town): Rider[] {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS).filter((r) => r.active);
  return town ? riders.filter((r) => r.town === town) : riders;
}

/** Unfiltered rider list (including inactive) for admin management. */
export function getAllDemoRiders(): Rider[] {
  ensureSeeded();
  return read<Rider[]>(KEYS.riders, DEMO_RIDERS);
}

export function upsertDemoRider(
  data: Partial<Rider> & { name: string },
): Rider {
  ensureSeeded();
  const riders = read<Rider[]>(KEYS.riders, DEMO_RIDERS);
  if (data.id) {
    const next = riders.map((r) => (r.id === data.id ? { ...r, ...data } : r));
    write(KEYS.riders, next);
    return next.find((r) => r.id === data.id)!;
  }
  const rider: Rider = {
    id: `rider-${Date.now()}`,
    name: data.name,
    phone: data.phone ?? null,
    town: data.town ?? null,
    vehicle: data.vehicle ?? "boda",
    active: data.active ?? true,
    created_at: new Date().toISOString(),
  };
  write(KEYS.riders, [rider, ...riders]);
  return rider;
}

export function getDemoDropoffPoints(town?: Town): DropoffPoint[] {
  ensureSeeded();
  const points = read<DropoffPoint[]>(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  return town ? points.filter((p) => p.town === town) : points;
}

export function getDemoRiderOrders(riderId: string): Order[] {
  ensureSeeded();
  return read<Order[]>(KEYS.orders, DEMO_ORDERS)
    .filter((o) => o.rider_id === riderId)
    .map((o) => ({
      ...o,
      rider_delivery_status: normalizeRiderDeliveryStatus(o),
    }))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoRiderPayouts(riderId?: string): RiderPayout[] {
  ensureSeeded();
  const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
  const list = riderId ? payouts.filter((p) => p.rider_id === riderId) : payouts;
  return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

/** Instant building-materials quote: matches free-text lines against the Hardware catalog. */
export function createDemoQuoteRequest(input: {
  user_id: string | null;
  customer_name: string;
  phone: string;
  town: Town;
  lines: { description: string; qty: number; unit: string }[];
}): QuoteRequest {
  ensureSeeded();
  const products = getDemoProducts({ activeOnly: true }).filter(
    (p) => p.category?.slug === QUOTE_CATALOG_CATEGORY_SLUG,
  );
  const { items, subtotal_kes, delivery_estimate_kes, total_kes, unmatched_count } =
    buildInstantQuote(input.lines, products, QUOTE_DELIVERY_ESTIMATE_KES);

  const quote: QuoteRequest = {
    id: `qr-${Date.now()}`,
    user_id: input.user_id,
    customer_name: input.customer_name,
    phone: input.phone,
    town: input.town,
    items,
    subtotal_kes,
    delivery_estimate_kes,
    total_kes,
    unmatched_count,
    status: "quoted",
    created_at: new Date().toISOString(),
    market_analysis: null,
  };

  // Market scan vs other suppliers — alert AMG when quote is not best-in-market
  const analysis = buildHeuristicQuoteAnalysis(
    quote,
    getDemoProducts({ activeOnly: true }),
    getDemoSuppliers(),
    getDemoSupplierAddresses(),
  );
  quote.market_analysis = analysis;

  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  write(KEYS.quoteRequests, [quote, ...list]);

  pushNotification({
    user_id: "demo-admin",
    title: "New building-materials quote request",
    body: `${input.customer_name} requested a quote for ${items.length} item(s) in ${input.town}.${
      unmatched_count > 0 ? ` ${unmatched_count} item(s) need manual pricing.` : ""
    }`,
    link: "/admin/quotes",
  });

  if (analysis.has_better_prices) {
    pushNotification({
      user_id: "demo-admin",
      title: "AI price alert — better supplier quotes available",
      body: `${input.customer_name}'s quote may be overpriced. Potential savings ~${analysis.potential_savings_kes.toLocaleString("en-KE")} KES. ${analysis.summary}`,
      link: "/admin/quotes",
    });
  }

  return quote;
}

export function saveDemoQuoteMarketAnalysis(
  quoteId: string,
  analysis: QuoteMarketAnalysis,
): QuoteRequest | null {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  const next = list.map((q) =>
    q.id === quoteId ? { ...q, market_analysis: analysis } : q,
  );
  write(KEYS.quoteRequests, next);
  const saved = next.find((q) => q.id === quoteId) ?? null;
  if (saved?.market_analysis?.has_better_prices) {
    pushNotification({
      user_id: "demo-admin",
      title: "AI price alert — better supplier quotes available",
      body: `${saved.customer_name}: potential savings ~${saved.market_analysis.potential_savings_kes.toLocaleString("en-KE")} KES. ${saved.market_analysis.summary}`,
      link: "/admin/quotes",
    });
  }
  return saved;
}

export function getDemoQuoteRequests(userId?: string): QuoteRequest[] {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  const filtered = userId ? list.filter((q) => q.user_id === userId) : list;
  return filtered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoQuoteRequest(id: string): QuoteRequest | null {
  ensureSeeded();
  return read<QuoteRequest[]>(KEYS.quoteRequests, []).find((q) => q.id === id) ?? null;
}

export function markDemoQuoteConverted(id: string, orderId: string): void {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  write(
    KEYS.quoteRequests,
    list.map((q) =>
      q.id === id ? { ...q, status: "converted" as const, converted_order_id: orderId } : q,
    ),
  );
}
