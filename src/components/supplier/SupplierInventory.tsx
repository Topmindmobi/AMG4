"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatKes } from "@/lib/format";
import {
  adjustDemoProductStock,
  setDemoProductActive,
} from "@/lib/store/demo-store";
import type { Product } from "@/lib/types";

type StockFilter = "all" | "low" | "oos" | "inactive";

const LOW = 5;

export function SupplierInventory({
  supplierId,
  initialProducts,
}: {
  supplierId: string;
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    return {
      skus: products.length,
      units: active.reduce((s, p) => s + p.stock, 0),
      value: active.reduce((s, p) => s + p.price_kes * p.stock, 0),
      low: active.filter((p) => p.stock > 0 && p.stock <= LOW).length,
      oos: active.filter((p) => p.stock === 0).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (filter === "low") return p.is_active && p.stock > 0 && p.stock <= LOW;
        if (filter === "oos") return p.is_active && p.stock === 0;
        if (filter === "inactive") return !p.is_active;
        return true;
      })
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query) ||
          (p.barcode || "").toLowerCase().includes(query) ||
          (p.category?.name || "").toLowerCase().includes(query),
      )
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [products, filter, q]);

  function refreshProduct(updated: Product) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === updated.id
          ? { ...updated, category: p.category ?? updated.category }
          : p,
      ),
    );
  }

  function saveStock(product: Product) {
    const raw = drafts[product.id] ?? String(product.stock);
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      setMessage("Enter a valid stock quantity (0 or more).");
      return;
    }
    const updated = adjustDemoProductStock(product.id, next, supplierId);
    if (!updated) {
      setMessage("Could not update stock for this product.");
      return;
    }
    refreshProduct(updated);
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[product.id];
      return copy;
    });
    setMessage(`Updated stock for “${product.name}” to ${updated.stock}.`);
  }

  function bump(product: Product, delta: number) {
    const updated = adjustDemoProductStock(
      product.id,
      product.stock + delta,
      supplierId,
    );
    if (!updated) return;
    refreshProduct(updated);
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[product.id];
      return copy;
    });
  }

  function toggleActive(product: Product) {
    const updated = setDemoProductActive(
      product.id,
      !product.is_active,
      supplierId,
    );
    if (!updated) return;
    refreshProduct(updated);
    setMessage(
      updated.is_active
        ? `“${product.name}” is now active in the shop.`
        : `“${product.name}” hidden from the shop.`,
    );
  }

  const filters: { key: StockFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "low", label: `Low stock (≤${LOW})` },
    { key: "oos", label: "Out of stock" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="SKUs" value={String(stats.skus)} />
        <Stat label="Units on hand" value={String(stats.units)} />
        <Stat label="Inventory value" value={formatKes(stats.value)} />
        <Stat label="Low stock" value={String(stats.low)} hint={`Active, 1–${LOW}`} />
        <Stat label="Out of stock" value={String(stats.oos)} />
      </div>

      {message && (
        <p className="mt-4 border border-forest/30 bg-forest/5 px-3 py-2 text-sm text-charcoal">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`border px-3 py-1.5 text-xs font-medium ${
                filter === f.key
                  ? "border-ember text-ember"
                  : "border-line text-ink-soft hover:text-charcoal"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, barcode, category…"
          className="min-w-[220px] flex-1 border border-line bg-white px-3 py-2 text-sm text-charcoal sm:max-w-xs"
        />
      </div>

      <div className="mt-6 overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 pb-3 pt-4 font-medium">Product</th>
              <th className="pb-3 pt-4 font-medium">Category</th>
              <th className="pb-3 pt-4 font-medium">Price</th>
              <th className="pb-3 pt-4 font-medium">Stock</th>
              <th className="pb-3 pt-4 font-medium">Value</th>
              <th className="pb-3 pt-4 font-medium">Status</th>
              <th className="px-4 pb-3 pt-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((p) => {
              const draft = drafts[p.id];
              const dirty =
                draft !== undefined && Number(draft) !== p.stock;
              const stockClass =
                p.stock === 0
                  ? "text-ember"
                  : p.stock <= LOW
                    ? "text-ember/90"
                    : "text-charcoal";
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/supplier/products/${p.id}`}
                      className="font-medium hover:text-ember"
                    >
                      {p.name}
                    </Link>
                    {p.barcode && (
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {p.barcode}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-ink-soft">
                    {p.category?.name || "—"}
                  </td>
                  <td className="py-3 tabular-nums">
                    {formatKes(p.price_kes)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Decrease stock"
                        onClick={() => bump(p, -1)}
                        className="border border-line px-3 py-2 text-sm text-ink-soft hover:border-forest hover:text-charcoal"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draft ?? String(p.stock)}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveStock(p);
                        }}
                        className={`w-20 border border-line bg-white px-2 py-2 text-sm tabular-nums ${stockClass}`}
                      />
                      <button
                        type="button"
                        aria-label="Increase stock"
                        onClick={() => bump(p, 1)}
                        className="border border-line px-3 py-2 text-sm text-ink-soft hover:border-forest hover:text-charcoal"
                      >
                        +
                      </button>
                      {dirty && (
                        <button
                          type="button"
                          onClick={() => saveStock(p)}
                          className="bg-forest px-3 py-2 text-xs font-semibold text-sand-light"
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 tabular-nums text-ink-soft">
                    {formatKes(p.price_kes * p.stock)}
                  </td>
                  <td className="py-3">
                    {p.is_active ? (
                      p.stock === 0 ? (
                        <span className="text-ember">Out of stock</span>
                      ) : p.stock <= LOW ? (
                        <span className="text-ember">Low</span>
                      ) : (
                        <span className="text-forest">In stock</span>
                      )
                    ) : (
                      <span className="text-ink-soft">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => toggleActive(p)}
                        className="font-medium text-ink-soft hover:text-charcoal"
                      >
                        {p.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <Link
                        href={`/supplier/products/${p.id}`}
                        className="font-medium text-forest hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-sm text-ink-soft">
            No products match this filter.{" "}
            <Link href="/supplier/products/new" className="text-ember">
              Add a product
            </Link>{" "}
            or{" "}
            <Link href="/supplier/products/import" className="text-ember">
              bulk import
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-line bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-2xl text-charcoal">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
