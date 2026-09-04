"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pagination } from "@/components/admin/Pagination";
import { ProductThumb } from "@/components/admin/ProductThumb";
import { formatKes } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoProducts, setDemoProductActive } from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

const PRODUCTS_PAGE_SIZE = 25;

function markupLabel(p: Product): string {
  if (!p.markup_type) return "Needs review";
  if (p.markup_type === "percent") return `${p.markup_value ?? 0}%`;
  return `+${formatKes(p.markup_value ?? 0)}`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

  function load() {
    if (isDemoMode()) {
      void Promise.resolve(getDemoProducts({ activeOnly: false })).then((all) => {
        const filtered = needsReviewOnly ? all.filter((p) => !p.markup_type) : all;
        setTotalProducts(filtered.length);
        setProducts(filtered.slice(page * PRODUCTS_PAGE_SIZE, page * PRODUCTS_PAGE_SIZE + PRODUCTS_PAGE_SIZE));
      });
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const from = page * PRODUCTS_PAGE_SIZE;
      const to = from + PRODUCTS_PAGE_SIZE - 1;
      let query = supabase
        .from("products")
        .select("*, category:categories(*)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (needsReviewOnly) query = query.is("markup_type", null);
      const { data, count } = await query;
      setProducts((data as Product[]) ?? []);
      setTotalProducts(count ?? null);
    })();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, needsReviewOnly]);

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-charcoal">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-ember px-4 py-2 text-sm font-semibold text-white"
        >
          Add product
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          setPage(0);
          setNeedsReviewOnly((v) => !v);
        }}
        className={`mt-4 border px-3 py-1.5 text-xs font-medium ${
          needsReviewOnly ? "border-ember text-ember" : "border-line text-ink-soft hover:text-charcoal"
        }`}
      >
        {needsReviewOnly ? "Showing: needs markup review" : "Show only: needs markup review"}
      </button>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="pb-3 font-medium" />
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Barcode</th>
              <th className="pb-3 font-medium">Price</th>
              <th className="pb-3 font-medium">Markup</th>
              <th className="pb-3 font-medium">Stock</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-3">
                  <Link href={`/admin/products/${p.id}`}>
                    <ProductThumb product={p} size={36} />
                  </Link>
                </td>
                <td className="py-3">
                  <Link href={`/admin/products/${p.id}`} className="hover:text-ember">
                    {p.name}
                  </Link>
                </td>
                <td className="py-3 font-mono text-xs text-ink-soft">
                  {p.barcode || "—"}
                </td>
                <td className="py-3">{formatKes(Number(p.price_kes))}</td>
                <td className={`py-3 ${!p.markup_type ? "font-semibold text-ember" : ""}`}>
                  {markupLabel(p)}
                </td>
                <td className="py-3">{p.stock}</td>
                <td className="py-3">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-semibold ${
                      p.is_active
                        ? "bg-forest/10 text-forest"
                        : "bg-crimson/10 text-crimson"
                    }`}
                  >
                    {p.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void toggleActive(p.id, p.is_active)}
                    className="text-ink-soft hover:text-ember"
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={PRODUCTS_PAGE_SIZE}
        count={totalProducts}
        onPageChange={setPage}
      />
    </div>
  );
}
