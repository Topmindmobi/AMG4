"use client";

import { useEffect, useState } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { useAuth } from "@/lib/auth-context";
import { getDemoCategories, getDemoSuppliers } from "@/lib/store/demo-store";
import type { Category, Supplier } from "@/lib/types";

export default function SupplierNewProductPage() {
  const { supplierId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setCategories(getDemoCategories());
      setSuppliers(getDemoSuppliers());
    });
  }, []);

  if (!supplierId) return null;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Add product</h1>
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        lockedSupplierId={supplierId}
        redirectBase="/supplier/products"
      />
    </div>
  );
}
