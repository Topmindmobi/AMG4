"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoProductsBySupplier } from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

export default function SupplierProductsPage() {
  const { supplierId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!supplierId) return;
    if (isDemoMode()) {
      void Promise.resolve(getDemoProductsBySupplier(supplierId)).then(setProducts);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
    })();
  }, [supplierId]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-charcoal">My products</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Products you add appear in the AMG Online Store shop. Buyers never see your supplier name.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/supplier/inventory"
            className="border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:text-charcoal"
          >
            Inventory
          </Link>
          <Link
            href="/supplier/products/import"
            className="border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5"
          >
            Bulk import
          </Link>
          <Link
            href="/supplier/products/new"
            className="bg-ember px-4 py-2 text-sm font-semibold text-white"
          >
            Add product
          </Link>
        </div>
      </div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Your price</th>
              <th className="pb-3 font-medium">Stock</th>
              <th className="pb-3 font-medium">Active</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-3">
                  <Link href={`/supplier/products/${p.id}`} className="hover:text-ember">
                    {p.name}
                  </Link>
                </td>
                <td className="py-3">{formatKes(Number(p.supplier_price_kes))}</td>
                <td className="py-3">{p.stock}</td>
                <td className="py-3">{p.is_active ? "Yes" : "No"}</td>
                <td className="py-3">
                  {p.markup_type ? (
                    <span className="text-forest">Live</span>
                  ) : (
                    <span className="font-semibold text-ember">Pending admin review</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 && (
        <p className="mt-8 text-sm text-ink-soft">No products yet. Add your first item.</p>
      )}
    </div>
  );
}
