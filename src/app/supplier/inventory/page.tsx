"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SupplierInventory } from "@/components/supplier/SupplierInventory";
import { useAuth } from "@/lib/auth-context";
import { getDemoProductsBySupplier } from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

export default function SupplierInventoryPage() {
  const { supplierId } = useAuth();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    void Promise.resolve(getDemoProductsBySupplier(supplierId)).then(setProducts);
  }, [supplierId]);

  if (!supplierId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Inventory</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Track stock levels, restock quickly, and keep low-stock SKUs visible before
            they go out of stock in the shop.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/supplier/reports"
            className="border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5"
          >
            Reports
          </Link>
          <Link
            href="/supplier/products/import"
            className="border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:text-charcoal"
          >
            Bulk import
          </Link>
        </div>
      </div>
      <div className="mt-8">
        {products ? (
          <SupplierInventory supplierId={supplierId} initialProducts={products} />
        ) : (
          <p className="text-sm text-ink-soft">Loading inventory…</p>
        )}
      </div>
    </div>
  );
}
