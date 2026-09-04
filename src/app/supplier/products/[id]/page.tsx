"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/supabase/config";
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
    if (!supplierId) return;

    if (isDemoMode()) {
      const p = getDemoProductById(params.id);
      if (p && p.supplier_id !== supplierId) {
        router.replace("/supplier/products");
        return;
      }
      void Promise.resolve().then(() => {
        setProduct(p);
        setCategories(getDemoCategories());
        setSuppliers(getDemoSuppliers());
      });
      return;
    }

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
        supabase.from("products").select("*").eq("id", params.id).maybeSingle(),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("suppliers").select("*").order("name"),
      ]);
      const product = p as Product | null;
      if (product && product.supplier_id !== supplierId) {
        router.replace("/supplier/products");
        return;
      }
      setProduct(product);
      setCategories((c as Category[]) ?? []);
      setSuppliers((s as Supplier[]) ?? []);
    })();
  }, [params.id, supplierId, router]);

  if (!product || !supplierId) {
    return <p className="text-ink-soft">Loading product…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Edit product</h1>
      <ProductForm
        product={product}
        categories={categories}
        suppliers={suppliers}
        lockedSupplierId={supplierId}
      />
    </div>
  );
}
