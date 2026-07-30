"use client";

import { useEffect, useState } from "react";
import { ProductForm } from "@/components/admin/ProductForm";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoCategories, getDemoSuppliers } from "@/lib/store/demo-store";
import type { Category, Supplier } from "@/lib/types";

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (isDemoMode()) {
      setCategories(getDemoCategories());
      setSuppliers(getDemoSuppliers());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("suppliers").select("*").order("name"),
      ]);
      setCategories((c as Category[]) ?? []);
      setSuppliers((s as Supplier[]) ?? []);
    })();
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">New product</h1>
      <ProductForm categories={categories} suppliers={suppliers} />
    </div>
  );
}
