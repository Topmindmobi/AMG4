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
  QuoteRequest,
  Rider,
  RiderPayout,
  Supplier,
  SupplyRequest,
  SupplyRequestStatus,
  Town,
} from "@/lib/types";
import type {
  EnsureCustomerAccountInput,
  EnsureCustomerAccountResult,
} from "@/lib/auth/ensure-customer-account";
import { generateTemporaryPassword } from "@/lib/auth/password";
import {
  formatKes,
  PAY_NOW_DISCOUNT_RATE,
  QUOTE_DELIVERY_ESTIMATE_KES,
  RIDER_PAYOUT_KES,
  slugify,
} from "@/lib/format";
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
  if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, DEMO_ORDERS);
  if (!localStorage.getItem(KEYS.supplyRequests)) write(KEYS.supplyRequests, []);
  if (!localStorage.getItem(KEYS.notifications)) write(KEYS.notifications, []);
  if (!localStorage.getItem(KEYS.riders)) write(KEYS.riders, DEMO_RIDERS);
  if (!localStorage.getItem(KEYS.dropoffPoints)) write(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  if (!localStorage.getItem(KEYS.riderPayouts)) write(KEYS.riderPayouts, []);
  if (!localStorage.getItem(KEYS.quoteRequests)) write(KEYS.quoteRequests, []);
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

/**
 * Guest checkout: create a customer account for the email if none exists.
 * Does not sign the user in. Never throws for "already exists".
 */
export function ensureDemoCustomerAccount(
  input: EnsureCustomerAccountInput,
): EnsureCustomerAccountResult {
  ensureSeeded();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return {
      userId: null,
      created: false,
      existed: false,
      email,
      error: "Invalid email",
    };
  }

  const existing = findDemoProfileByEmail(email);
  if (existing) {
    return {
      userId: existing.id,
      created: false,
      existed: true,
      email,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const profiles = read<Profile[]>(KEYS.profiles, []);
  const profile: Profile = {
    id: `user-${email}`,
    full_name: input.fullName.trim() || email.split("@")[0] || "Customer",
    phone: input.phone?.trim() || null,
    role: "customer",
    town: (input.town === "Homabay" || input.town === "Mbita" || input.town === "Migori"
      ? input.town
      : null),
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
    temporaryPassword,
  };
}

export function demoLogout() {
  if (typeof window === "undefined") return;
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
    id: `prod-${Date.now()}`,
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

export function getDemoSupplyRequests(filters?: {
  supplierId?: string;
  orderId?: string;
}): SupplyRequest[] {
  ensureSeeded();
  let list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
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
  return (
    read<SupplyRequest[]>(KEYS.supplyRequests, []).find((r) => r.id === id) ??
    null
  );
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

/** Supplier confirms they will supply */
export function confirmDemoSupplyRequest(requestId: string): SupplyRequest {
  ensureSeeded();
  const list = read<SupplyRequest[]>(KEYS.supplyRequests, []);
  const request = list.find((r) => r.id === requestId);
  if (!request) throw new Error("Supply request not found");
  if (request.status === "confirmed") return request;

  const updated: SupplyRequest = {
    ...request,
    status: "confirmed" as SupplyRequestStatus,
    confirmed_at: new Date().toISOString(),
  };
  write(
    KEYS.supplyRequests,
    list.map((r) => (r.id === requestId ? updated : r)),
  );

  const orderRequests = getDemoSupplyRequests({ orderId: request.order_id });
  const order = getDemoOrder(request.order_id);
  const assignedIds = new Set(
    (order?.items ?? [])
      .map((i) => i.supplier_id)
      .filter((id): id is string => Boolean(id)),
  );
  const allConfirmed = Array.from(assignedIds).every((sid) =>
    orderRequests.some((r) => r.supplier_id === sid && r.status === "confirmed"),
  );
  if (allConfirmed) {
    updateDemoOrderStatus(request.order_id, "supplier_confirmed");
  }

  pushNotification({
    user_id: "demo-admin",
    title: `${request.supplier_name} confirmed supply`,
    body: `Order ${request.order_id}: supplier confirmed. You can now confirm the order to the buyer.`,
    link: "/admin/orders",
    order_id: request.order_id,
    supply_request_id: request.id,
  });

  return updated;
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
  const next = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "out_for_delivery" as const,
          rider_id: rider.id,
          rider_name_snapshot: rider.name,
        }
      : o,
  );
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

  if (order?.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Your AMG.COM order is out for delivery",
      body: `Order ${shortId(order.id)} is on its way${
        order.delivery_method === "dropoff" && order.dropoff_point_name
          ? ` to ${order.dropoff_point_name}`
          : " to your doorstep"
      }.`,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }

  return order;
}

/** Rider marks an order handed over at the drop point / doorstep. Triggers payout + notifications. */
export function deliverDemoOrder(orderId: string): { order: Order; payout: RiderPayout | null } {
  ensureSeeded();
  const order = getDemoOrder(orderId);
  if (!order) throw new Error("Order not found");

  const deliveredAt = new Date().toISOString();
  const orders = read<Order[]>(KEYS.orders, DEMO_ORDERS);
  const next = orders.map((o) =>
    o.id === orderId
      ? { ...o, status: "delivered" as const, delivered_at: deliveredAt }
      : o,
  );
  write(KEYS.orders, next);
  const updatedOrder = next.find((o) => o.id === orderId)!;

  let payout: RiderPayout | null = null;
  if (order.rider_id) {
    payout = {
      id: `payout-${Date.now()}`,
      order_id: order.id,
      rider_id: order.rider_id,
      rider_name: order.rider_name_snapshot ?? "Rider",
      amount_kes: RIDER_PAYOUT_KES,
      status: "sent",
      created_at: deliveredAt,
    };
    const payouts = read<RiderPayout[]>(KEYS.riderPayouts, []);
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
  }

  if (order.user_id) {
    pushNotification({
      user_id: order.user_id,
      title: "Your AMG.COM order was delivered",
      body: `Order ${shortId(order.id)} has been delivered${
        order.delivery_method === "dropoff" && order.dropoff_point_name
          ? ` to ${order.dropoff_point_name}`
          : " to your doorstep"
      }. Asante for shopping with AMG.COM!`,
      link: `/order/${order.id}`,
      order_id: order.id,
    });
  }

  return { order: updatedOrder, payout };
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

export function getDemoDropoffPoints(town?: Town): DropoffPoint[] {
  ensureSeeded();
  const points = read<DropoffPoint[]>(KEYS.dropoffPoints, DEMO_DROPOFF_POINTS);
  return town ? points.filter((p) => p.town === town) : points;
}

export function getDemoRiderOrders(riderId: string): Order[] {
  ensureSeeded();
  return read<Order[]>(KEYS.orders, DEMO_ORDERS)
    .filter((o) => o.rider_id === riderId)
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
  };
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

  return quote;
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
