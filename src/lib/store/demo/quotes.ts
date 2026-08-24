"use client";

/**
 * Demo-mode instant building-materials quotes. Part of the `demo-store.ts`
 * module split — see that file.
 */

import { buildHeuristicQuoteAnalysis } from "@/lib/quote-market-analysis";
import { QUOTE_DELIVERY_ESTIMATE_KES } from "@/lib/format";
import { buildInstantQuote, QUOTE_CATALOG_CATEGORY_SLUG } from "@/lib/quotes";
import type { QuoteMarketAnalysis, QuoteRequest, Town } from "@/lib/types";
import { getDemoProducts, getDemoSupplierAddresses, getDemoSuppliers } from "./catalog";
import { ensureSeeded, KEYS, read, write } from "./core";
import { pushNotification } from "./notifications";

/** Instant building-materials quote: matches free-text lines against the Hardware catalog. */
export function createDemoQuoteRequest(input: {
  user_id: string | null;
  customer_name: string;
  phone: string;
  town: Town;
  lines: { description: string; qty: number; unit: string }[];
}): QuoteRequest {
  ensureSeeded();
  const products = getDemoProducts({ activeOnly: true }).filter(
    (p) => p.category?.slug === QUOTE_CATALOG_CATEGORY_SLUG,
  );
  const { items, subtotal_kes, delivery_estimate_kes, total_kes, unmatched_count } =
    buildInstantQuote(input.lines, products, QUOTE_DELIVERY_ESTIMATE_KES);

  const quote: QuoteRequest = {
    id: `qr-${Date.now()}`,
    user_id: input.user_id,
    customer_name: input.customer_name,
    phone: input.phone,
    town: input.town,
    items,
    subtotal_kes,
    delivery_estimate_kes,
    total_kes,
    unmatched_count,
    status: "quoted",
    created_at: new Date().toISOString(),
    market_analysis: null,
  };

  // Market scan vs other suppliers — alert AMG when quote is not best-in-market
  const analysis = buildHeuristicQuoteAnalysis(
    quote,
    getDemoProducts({ activeOnly: true }),
    getDemoSuppliers(),
    getDemoSupplierAddresses(),
  );
  quote.market_analysis = analysis;

  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  write(KEYS.quoteRequests, [quote, ...list]);

  pushNotification({
    user_id: "demo-admin",
    title: "New building-materials quote request",
    body: `${input.customer_name} requested a quote for ${items.length} item(s) in ${input.town}.${
      unmatched_count > 0 ? ` ${unmatched_count} item(s) need manual pricing.` : ""
    }`,
    link: "/admin/quotes",
  });

  if (analysis.has_better_prices) {
    pushNotification({
      user_id: "demo-admin",
      title: "AI price alert — better supplier quotes available",
      body: `${input.customer_name}'s quote may be overpriced. Potential savings ~${analysis.potential_savings_kes.toLocaleString("en-KE")} KES. ${analysis.summary}`,
      link: "/admin/quotes",
    });
  }

  return quote;
}

export function saveDemoQuoteMarketAnalysis(
  quoteId: string,
  analysis: QuoteMarketAnalysis,
): QuoteRequest | null {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  const next = list.map((q) =>
    q.id === quoteId ? { ...q, market_analysis: analysis } : q,
  );
  write(KEYS.quoteRequests, next);
  const saved = next.find((q) => q.id === quoteId) ?? null;
  if (saved?.market_analysis?.has_better_prices) {
    pushNotification({
      user_id: "demo-admin",
      title: "AI price alert — better supplier quotes available",
      body: `${saved.customer_name}: potential savings ~${saved.market_analysis.potential_savings_kes.toLocaleString("en-KE")} KES. ${saved.market_analysis.summary}`,
      link: "/admin/quotes",
    });
  }
  return saved;
}

export function getDemoQuoteRequests(userId?: string): QuoteRequest[] {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  const filtered = userId ? list.filter((q) => q.user_id === userId) : list;
  return filtered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getDemoQuoteRequest(id: string): QuoteRequest | null {
  ensureSeeded();
  return read<QuoteRequest[]>(KEYS.quoteRequests, []).find((q) => q.id === id) ?? null;
}

export function markDemoQuoteConverted(id: string, orderId: string): void {
  ensureSeeded();
  const list = read<QuoteRequest[]>(KEYS.quoteRequests, []);
  write(
    KEYS.quoteRequests,
    list.map((q) =>
      q.id === id ? { ...q, status: "converted" as const, converted_order_id: orderId } : q,
    ),
  );
}
