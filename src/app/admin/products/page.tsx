"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductThumb } from "@/components/shared/ProductThumb";
import { formatKes } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoProducts, setDemoProductActive } from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

function markupLabel(p: Product): string {
  if (!p.markup_type) return "Needs review";
  if (p.markup_type === "percent") return `${p.markup_value ?? 0}%`;
  return `+${formatKes(p.markup_value ?? 0)}`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    if (isDemoMode()) {
      void Promise.resolve(getDemoProducts({ activeOnly: false })).then(setProducts);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // Grouping by category means the full catalog needs to be on screen
      // at once — pagination doesn't make sense once products are grouped,
      // since a page break would cut a category in half. The search box
      // below is the scaling mechanism instead.
      const { data } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .order("name");
      setProducts((data as Product[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleActive(id: string, currentlyActive: boolean) {
    const nextActive = !currentlyActive;
    if (!confirm(nextActive ? "Activate this product?" : "Deactivate this product?")) return;
    if (isDemoMode()) {
      setDemoProductActive(id, nextActive);
      load();
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("products").update({ is_active: nextActive }).eq("id", id);
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (needsReviewOnly && p.markup_type) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, needsReviewOnly, search]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; sortOrder: number; products: Product[] }>();
    for (const p of filtered) {
      const key = p.category?.id ?? "uncategorized";
      if (!map.has(key)) {
        map.set(key, {
          name: p.category?.name ?? "Uncategorized",
          sortOrder: p.category?.sort_order ?? Number.MAX_SAFE_INTEGER,
          products: [],
        });
      }
      map.get(key)!.products.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-charcoal">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-ember px-4 py-2 text-sm font-semibold text-white"
        >
          Add product
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name…"
          className="w-full max-w-xs border border-line bg-white px-3 py-2 text-sm text-charcoal"
        />
        <button
          type="button"
          onClick={() => setNeedsReviewOnly((v) => !v)}
          className={`border px-3 py-1.5 text-xs font-medium ${
            needsReviewOnly ? "border-ember text-ember" : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          {needsReviewOnly ? "Showing: needs markup review" : "Show only: needs markup review"}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No products match.</p>
      ) : (
        groups.map((group) => (
          <section key={group.name} className="mt-10">
            <h2 className="font-display text-xl text-charcoal">{group.name}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {group.products.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
                  <Link href={`/admin/products/${p.id}`}>
                    <ProductThumb
                      product={p}
                      size={72}
                      zoomOnHover
                      className="rounded-lg shadow-md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-bold text-charcoal hover:text-ember"
                    >
                      {p.name}
                    </Link>
                    {(p.short_description || p.description) && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
                        {p.short_description || p.description}
                      </p>
                    )}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                      <span className="font-mono">{p.barcode || "—"}</span>
                      <span>{formatKes(Number(p.price_kes))}</span>
                      <span className={!p.markup_type ? "font-semibold text-ember" : ""}>
                        {markupLabel(p)}
                      </span>
                      <span>{p.stock} in stock</span>
                      <span
                        className={`px-1.5 py-0.5 font-semibold ${
                          p.is_active ? "bg-forest/10 text-forest" : "bg-crimson/10 text-crimson"
                        }`}
                      >
                        {p.is_active ? "Active" : "Deactivated"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleActive(p.id, p.is_active)}
                    className="shrink-0 text-sm text-ink-soft hover:text-ember"
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
