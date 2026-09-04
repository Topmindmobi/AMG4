"use client";

/**
 * Demo-mode product/category/supplier/supplier-address catalog.
 * Part of the `demo-store.ts` module split — see that file.
 */

import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_SUPPLIER_ADDRESSES,
  DEMO_SUPPLIERS,
} from "@/lib/demo-data";
import { slugify } from "@/lib/format";
import { computeProductPriceKes } from "@/lib/pricing";
import type {
  Category,
  Product,
  Supplier,
  SupplierAddress,
  SupplierAddressLabel,
  Town,
} from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";

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
    products = products.filter((p) => p.is_active && p.markup_type != null);
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

export function upsertDemoProduct(
  data: Partial<Product> & { name: string; category_id: string; supplier_price_kes: number },
): Product {
  ensureSeeded();
  const products = read<Product[]>(KEYS.products, DEMO_PRODUCTS);
  if (data.id) {
    const next = products.map((p) => {
      if (p.id !== data.id) return p;
      // markup_type/markup_value are omitted entirely from a non-admin
      // (supplier) submission — {...p, ...data} then naturally preserves
      // whatever admin already set, mirroring the production trigger's
      // "non-admin writes can't touch markup" behavior.
      const merged = { ...p, ...data, slug: data.slug || p.slug };
      merged.price_kes = computeProductPriceKes(
        merged.supplier_price_kes,
        merged.markup_type,
        merged.markup_value,
      );
      return merged;
    });
    write(KEYS.products, next);
    return next.find((p) => p.id === data.id)!;
  }
  const short = data.short_description || data.description || "";
  const markup_type = data.markup_type ?? null;
  const markup_value = data.markup_value ?? null;
  const product: Product = {
    id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category_id: data.category_id,
    supplier_id: data.supplier_id ?? null,
    name: data.name,
    slug: data.slug || slugify(data.name),
    short_description: short,
    detailed_description: data.detailed_description || short,
    description: short,
    supplier_price_kes: data.supplier_price_kes,
    markup_type,
    markup_value,
    price_kes: computeProductPriceKes(data.supplier_price_kes, markup_type, markup_value),
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
  setDemoProductActive(id, false);
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

export function getDemoProductsBySupplier(supplierId: string): Product[] {
  ensureSeeded();
  return getDemoProducts({ activeOnly: false }).filter(
    (p) => p.supplier_id === supplierId,
  );
}
