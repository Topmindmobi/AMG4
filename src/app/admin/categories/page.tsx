"use client";

import { FormEvent, useEffect, useState } from "react";
import { slugify } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoCategories, upsertDemoCategory } from "@/lib/store/demo-store";
import type { Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  function load() {
    if (isDemoMode()) {
      setCategories(getDemoCategories());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      setCategories((data as Category[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const parent_id = String(fd.get("parent_id") || "") || null;
    const payload = {
      name,
      slug: slugify(name),
      parent_id,
      sort_order: Number(fd.get("sort_order") || categories.length + 1),
      description: String(fd.get("description") || "") || null,
    };

    if (isDemoMode()) {
      upsertDemoCategory(payload);
      (e.target as HTMLFormElement).reset();
      load();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("categories").insert(payload);
    (e.target as HTMLFormElement).reset();
    load();
  }

  const tops = categories.filter((c) => !c.parent_id);

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Categories</h1>
      <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-3">
        <input
          name="name"
          required
          placeholder="Category name"
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <select
          name="parent_id"
          className="border border-white/15 bg-forest-deep px-3 py-2 text-sm"
        >
          <option value="">Top-level category</option>
          {tops.map((c) => (
            <option key={c.id} value={c.id}>
              Child of {c.name}
            </option>
          ))}
        </select>
        <input
          name="sort_order"
          type="number"
          placeholder="Sort order"
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <input
          name="description"
          placeholder="Description"
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-ember px-4 py-2 text-sm font-semibold text-white">
          Add category
        </button>
      </form>

      <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
        {categories.map((c) => (
          <li key={c.id} className="py-3 text-sm">
            <p className="font-medium">
              {c.name}
              {c.parent_id && (
                <span className="ml-2 text-xs text-sand/40">
                  child of {categories.find((p) => p.id === c.parent_id)?.name}
                </span>
              )}
            </p>
            <p className="text-xs text-sand/45">/{c.slug}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
