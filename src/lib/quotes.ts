import type { Product, QuoteRequestItem } from "@/lib/types";

/** Building-materials category slug the instant-quote engine matches against. */
export const QUOTE_CATALOG_CATEGORY_SLUG = "hardware";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Matches one free-text request line (e.g. "iron sheets", qty 10) against the
 * building-materials catalog by token overlap. Runs synchronously so the
 * quote can be "instant" — no waiting on a human to price it.
 */
export function matchQuoteLine(
  line: { description: string; qty: number; unit: string },
  products: Product[],
): QuoteRequestItem {
  const queryTokens = new Set(tokenize(line.description));
  let best: { product: Product; score: number } | null = null;

  for (const product of products) {
    const nameTokens = tokenize(product.name);
    const overlap = nameTokens.filter((t) => queryTokens.has(t)).length;
    const score = overlap / Math.max(nameTokens.length, queryTokens.size, 1);
    if (overlap > 0 && (!best || score > best.score)) {
      best = { product, score };
    }
  }

  if (best && best.score >= 0.2) {
    return {
      description: line.description,
      qty: line.qty,
      unit: line.unit,
      matched_product_id: best.product.id,
      matched_name: best.product.name,
      unit_price_kes: best.product.price_kes,
      line_total_kes: Math.round(best.product.price_kes * line.qty),
      matched: true,
    };
  }

  return {
    description: line.description,
    qty: line.qty,
    unit: line.unit,
    matched_product_id: null,
    matched_name: null,
    unit_price_kes: null,
    line_total_kes: 0,
    matched: false,
  };
}

export function buildInstantQuote(
  lines: { description: string; qty: number; unit: string }[],
  catalog: Product[],
  deliveryEstimateKes: number,
) {
  const items = lines.map((line) => matchQuoteLine(line, catalog));
  const subtotal_kes = items.reduce((s, i) => s + (i.line_total_kes ?? 0), 0);
  const unmatched_count = items.filter((i) => !i.matched).length;
  const delivery_estimate_kes = subtotal_kes > 0 ? deliveryEstimateKes : 0;
  return {
    items,
    subtotal_kes,
    delivery_estimate_kes,
    total_kes: subtotal_kes + delivery_estimate_kes,
    unmatched_count,
  };
}
