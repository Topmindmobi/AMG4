"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TOWNS } from "@/lib/format";
import type { Category } from "@/lib/types";

export function ShopFilters({
  categories,
  basePath = "/shop",
}: {
  categories: Category[];
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const town = params.get("town") ?? "";
  const category = params.get("category") ?? "";

  function update(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    });
    router.push(`${basePath}?${sp.toString()}`);
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        update({
          q: String(fd.get("q") || ""),
          town: String(fd.get("town") || ""),
          category: String(fd.get("category") || ""),
        });
      }}
    >
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Search
        <input
          name="q"
          defaultValue={q}
          placeholder="Phones, cement, eggs…"
          className="rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-forest"
        />
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Town
        <select
          name="town"
          defaultValue={town}
          className="amg-select rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-forest"
        >
          <option value="">All towns</option>
          {TOWNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Category
        <select
          name="category"
          defaultValue={category}
          className="amg-select rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-forest"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-deep"
      >
        Filter
      </button>
    </form>
  );
}
