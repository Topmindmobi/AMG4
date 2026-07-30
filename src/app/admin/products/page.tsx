"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKes } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { deleteDemoProduct, getDemoProducts } from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  function load() {
    if (isDemoMode()) {
      setProducts(getDemoProducts({ activeOnly: false }));
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function deactivate(id: string) {
    if (!confirm("Deactivate this product?")) return;
    if (isDemoMode()) {
      deleteDemoProduct(id);
      load();
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("products").update({ is_active: false }).eq("id", id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-sand">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-ember px-4 py-2 text-sm font-semibold text-white"
        >
          Add product
        </Link>
      </div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-sand/45">
            <tr>
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Barcode</th>
              <th className="pb-3 font-medium">Price</th>
              <th className="pb-3 font-medium">Stock</th>
              <th className="pb-3 font-medium">Active</th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-3">
                  <Link href={`/admin/products/${p.id}`} className="hover:text-ember">
                    {p.name}
                  </Link>
                </td>
                <td className="py-3 font-mono text-xs text-sand/60">
                  {p.barcode || "—"}
                </td>
                <td className="py-3">{formatKes(Number(p.price_kes))}</td>
                <td className="py-3">{p.stock}</td>
                <td className="py-3">{p.is_active ? "Yes" : "No"}</td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void deactivate(p.id)}
                    className="text-sand/45 hover:text-ember"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
