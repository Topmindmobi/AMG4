"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { useAuth } from "@/lib/auth-context";
import {
  getDemoCategories,
  getDemoProductById,
  getDemoSuppliers,
} from "@/lib/store/demo-store";
import type { Category, Product, Supplier } from "@/lib/types";

export default function SupplierEditProductPage() {
  const params = useParams<{ id: string }>();
  const { supplierId } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    const p = getDemoProductById(params.id);
    if (p && supplierId && p.supplier_id !== supplierId) {
      router.replace("/supplier/products");
      return;
    }
    setProduct(p);
    setCategories(getDemoCategories());
    setSuppliers(getDemoSuppliers());
  }, [params.id, supplierId, router]);

  if (!product || !supplierId) {
    return <p className="text-sand/60">Loading product…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Edit product</h1>
      <ProductForm
        product={product}
        categories={categories}
        suppliers={suppliers}
        lockedSupplierId={supplierId}
        redirectBase="/supplier/products"
      />
    </div>
  );
}
