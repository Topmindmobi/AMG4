import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_SUPPLIERS,
} from "@/lib/demo-data";
import { isDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Category, Product, Supplier, Town } from "@/lib/types";

function withRelations(products: Product[], categories: Category[], suppliers: Supplier[]): Product[] {
  return products.map((p) => ({
    ...p,
    category: categories.find((c) => c.id === p.category_id),
    supplier: suppliers.find((s) => s.id === p.supplier_id) ?? null,
  }));
}

export async function listCategories(): Promise<Category[]> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return [...DEMO_CATEGORIES].sort((a, b) => a.sort_order - b.sort_order);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data as Category[];
}

export async function listTopCategories(): Promise<Category[]> {
  const cats = await listCategories();
  return cats.filter((c) => !c.parent_id);
}

export async function listProducts(filters?: {
  categorySlug?: string;
  q?: string;
  town?: string;
  includeInactive?: boolean;
}): Promise<Product[]> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    let products = [...DEMO_PRODUCTS];
    const categories = DEMO_CATEGORIES;
    if (!filters?.includeInactive) {
      products = products.filter((p) => p.is_active);
    }
    if (filters?.categorySlug) {
      const cat = categories.find((c) => c.slug === filters.categorySlug);
      if (cat) {
        const childIds = categories.filter((c) => c.parent_id === cat.id).map((c) => c.id);
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
    return withRelations(products, categories, DEMO_SUPPLIERS);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*, category:categories(*), supplier:suppliers(*)")
    .order("created_at", { ascending: false });

  if (!filters?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (filters?.q) {
    query = query.or(
      `name.ilike.%${filters.q}%,short_description.ilike.%${filters.q}%,detailed_description.ilike.%${filters.q}%`,
    );
  }

  if (filters?.town) {
    query = query.contains("towns", [filters.town]);
  }

  const { data, error } = await query;
  if (error) throw error;
  let products = (data ?? []) as Product[];

  if (filters?.categorySlug) {
    const cats = await listCategories();
    const cat = cats.find((c) => c.slug === filters.categorySlug);
    if (cat) {
      const childIds = cats.filter((c) => c.parent_id === cat.id).map((c) => c.id);
      const ids = new Set([cat.id, ...childIds]);
      products = products.filter((p) => ids.has(p.category_id));
    }
  }

  return products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    const product = DEMO_PRODUCTS.find((p) => p.slug === slug);
    if (!product) return null;
    return withRelations([product], DEMO_CATEGORIES, DEMO_SUPPLIERS)[0];
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), supplier:suppliers(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    const product = DEMO_PRODUCTS.find((p) => p.id === id) ?? null;
    if (!product) return null;
    return withRelations([product], DEMO_CATEGORIES, DEMO_SUPPLIERS)[0];
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), supplier:suppliers(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function listSuppliers(): Promise<Supplier[]> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return [...DEMO_SUPPLIERS];
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data as Supplier[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const cats = await listCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}
