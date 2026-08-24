"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductBulkImport } from "@/components/supplier/ProductBulkImport";
import { useAuth } from "@/lib/auth-context";
import { getDemoCategories } from "@/lib/store/demo-store";
import type { Category } from "@/lib/types";

export default function SupplierProductImportPage() {
  const { supplierId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => setCategories(getDemoCategories()));
  }, []);

  if (!supplierId) return null;

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/supplier/products"
          className="text-sm font-medium text-ink-soft hover:text-forest"
        >
          ← My products
        </Link>
      </div>
      <h1 className="font-display text-3xl text-charcoal">Bulk import products</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Add many products at once with a CSV or Excel template. Download the template, fill your
        catalogue, then upload to preview and import.
      </p>
      <div className="mt-8">
        <ProductBulkImport supplierId={supplierId} categories={categories} />
      </div>
    </div>
  );
}
