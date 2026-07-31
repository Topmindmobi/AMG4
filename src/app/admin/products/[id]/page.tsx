"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoCategories,
  getDemoProductById,
  getDemoSuppliers,
} from "@/lib/store/demo-store";
import type { Category, Product, Supplier } from "@/lib/types";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (isDemoMode()) {
      void Promise.resolve().then(() => {
        setProduct(getDemoProductById(params.id));
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
      setProduct(p as Product | null);
      setCategories((c as Category[]) ?? []);
      setSuppliers((s as Supplier[]) ?? []);
    })();
  }, [params.id]);

  if (!product) {
    return <p className="text-sand/60">Loading product…</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Edit product</h1>
      <ProductForm product={product} categories={categories} suppliers={suppliers} />
    </div>
  );
}
