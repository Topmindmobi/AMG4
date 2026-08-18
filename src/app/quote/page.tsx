"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { formatKes, QUOTE_DELIVERY_ESTIMATE_KES, TOWNS } from "@/lib/format";
import { buildInstantQuote, QUOTE_CATALOG_CATEGORY_SLUG } from "@/lib/quotes";
import { getErrorMessage } from "@/lib/supabase/errors";
import { isDemoMode } from "@/lib/supabase/config";
import { analyzeQuoteWithAi } from "@/lib/quote-ai";
import {
  createDemoQuoteRequest,
  getDemoProductById,
  getDemoProducts,
  getDemoSupplierAddresses,
  getDemoSuppliers,
  saveDemoQuoteMarketAnalysis,
} from "@/lib/store/demo-store";
import type { Product, QuoteRequest, Town } from "@/lib/types";

type Line = { description: string; qty: number; unit: string };

const UNITS = ["pieces", "bags", "meters", "tons", "rolls", "kg"];
const EXAMPLES = ["Cement", "Iron sheets", "Sand", "Ballast", "Timber", "Nails", "Paint", "Wire"];

function emptyLine(): Line {
  return { description: "", qty: 1, unit: "pieces" };
}

export default function QuotePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();
  const [customerName, setCustomerName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [town, setTown] = useState<Town>(user?.town ?? "Homabay");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const validLines = lines
      .map((l) => ({ ...l, description: l.description.trim() }))
      .filter((l) => l.description && l.qty > 0);
    if (validLines.length === 0) {
      setError("Add at least one material with a quantity.");
      return;
    }
    if (!customerName.trim() || !phone.trim()) {
      setError("Name and phone are required so we can follow up.");
      return;
    }

    setLoading(true);
    try {
      if (isDemoMode()) {
        const q = createDemoQuoteRequest({
          user_id: user?.id ?? null,
          customer_name: customerName,
          phone,
          town,
          lines: validLines,
        });
        setQuote(q);
        // Refine heuristic market scan with AI narrative for AMG (non-blocking for buyer)
        void analyzeQuoteWithAi(
          q,
          getDemoProducts({ activeOnly: true }),
          getDemoSuppliers(),
          getDemoSupplierAddresses(),
        ).then((analysis) => {
          saveDemoQuoteMarketAnalysis(q.id, analysis);
        });
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("is_active", true);
      if (prodErr) throw prodErr;
      const hardware = ((products ?? []) as Product[]).filter(
        (p) => p.category?.slug === QUOTE_CATALOG_CATEGORY_SLUG,
      );
      const built = buildInstantQuote(validLines, hardware, QUOTE_DELIVERY_ESTIMATE_KES);
      const id = crypto.randomUUID();
      const created_at = new Date().toISOString();
      const { error: insErr } = await supabase.from("quote_requests").insert({
        id,
        user_id: user?.id ?? null,
        customer_name: customerName,
        phone,
        town,
        items: built.items,
        subtotal_kes: built.subtotal_kes,
        delivery_estimate_kes: built.delivery_estimate_kes,
        total_kes: built.total_kes,
        unmatched_count: built.unmatched_count,
        status: "quoted",
      });
      if (insErr) throw insErr;
      setQuote({
        id,
        user_id: user?.id ?? null,
        customer_name: customerName,
        phone,
        town,
        created_at,
        status: "quoted",
        ...built,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not build your quote"));
    } finally {
      setLoading(false);
    }
  }

  async function convertToOrder() {
    if (!quote) return;
    setConverting(true);
    try {
      const matched = quote.items.filter((i) => i.matched && i.matched_product_id);
      for (const item of matched) {
        let product: Product | null = null;
        if (isDemoMode()) {
          product = getDemoProductById(item.matched_product_id!);
        } else {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data } = await supabase
            .from("products")
            .select("*")
            .eq("id", item.matched_product_id!)
            .maybeSingle();
          product = data as Product | null;
        }
        if (product) addItem(product, item.qty);
      }
      router.push("/checkout");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Building materials</p>
      <h1 className="mt-2 font-display text-[clamp(30px,4vw,38px)] text-charcoal">
        Get an instant quote
      </h1>
      <p className="mt-3 text-ink-soft">
        List what you need for your site — cement, iron sheets, sand, timber, whatever it is — and
        we&apos;ll price it against our hardware catalog immediately. Anything we can&apos;t match
        gets flagged for a quick follow-up call, no waiting around for common items.
      </p>

      {!quote ? (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" value={customerName} onChange={setCustomerName} required />
            <TextField label="Phone" value={phone} onChange={setPhone} required />
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Delivery town
            <select
              value={town}
              onChange={(e) => setTown(e.target.value as Town)}
              className="amg-select mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal normal-case outline-none focus:border-forest"
            >
              {TOWNS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Materials</p>
            <p className="mt-1 text-xs text-ink-soft">
              Examples: {EXAMPLES.join(", ")} — use everyday names, not exact product titles.
            </p>
            <div className="mt-3 space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
                  <label className="min-w-[180px] flex-[2] text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Material
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      placeholder="e.g. Cement"
                      className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm normal-case outline-none focus:border-forest"
                    />
                  </label>
                  <label className="w-20 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Qty
                    <input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 1 })}
                      className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest"
                    />
                  </label>
                  <label className="w-28 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Unit
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      className="amg-select mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-charcoal normal-case outline-none focus:border-forest"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ember disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="mt-3 text-xs font-semibold text-forest underline"
            >
              + Add another material
            </button>
          </div>

          {error && <p className="text-sm text-ember">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ember py-3 text-[17px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
          >
            {loading ? "Building your quote…" : "Get instant quote"}
          </button>
        </form>
      ) : (
        <div className="mt-8">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">Item</th>
                  <th className="p-3 font-medium">Qty</th>
                  <th className="p-3 font-medium">Unit price</th>
                  <th className="p-3 font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {quote.items.map((item, i) => (
                  <tr key={i}>
                    <td className="p-3">
                      {item.matched ? (
                        <>
                          {item.matched_name}
                          <span className="block text-xs text-ink-soft">
                            matched from &ldquo;{item.description}&rdquo;
                          </span>
                        </>
                      ) : (
                        <>
                          {item.description}
                          <span className="block text-xs text-ember">
                            not in catalog — we&apos;ll call you to confirm pricing
                          </span>
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      {item.qty} {item.unit}
                    </td>
                    <td className="p-3">{item.unit_price_kes ? formatKes(item.unit_price_kes) : "—"}</td>
                    <td className="p-3 font-medium">
                      {item.matched ? formatKes(item.line_total_kes ?? 0) : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Matched subtotal</dt>
              <dd>{formatKes(quote.subtotal_kes)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Estimated delivery</dt>
              <dd>{formatKes(quote.delivery_estimate_kes)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold text-charcoal">
              <dt>Estimated total</dt>
              <dd>{formatKes(quote.total_kes)}</dd>
            </div>
          </dl>

          {quote.unmatched_count > 0 && (
            <p className="mt-4 rounded-lg border border-ember/30 bg-ember/10 p-3 text-sm text-ember">
              {quote.unmatched_count} item(s) aren&apos;t in our catalog yet. AMG will call{" "}
              {quote.phone} to confirm pricing on those separately.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {quote.subtotal_kes > 0 && (
              <button
                type="button"
                onClick={() => void convertToOrder()}
                disabled={converting}
                className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
              >
                {converting ? "Adding to cart…" : "Convert matched items to an order"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setQuote(null);
                setLines([emptyLine()]);
              }}
              className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft hover:text-charcoal"
            >
              Request another quote
            </button>
            <Link href="/shop" className="px-2 py-2.5 text-sm font-semibold text-forest underline">
              Back to shop
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-forest"
      />
    </label>
  );
}
