import {
  distanceToHubKm,
  estimateTransportKes,
} from "@/lib/geo";
import type {
  Product,
  QuoteLineAlert,
  QuoteLineMarketOffer,
  QuoteMarketAnalysis,
  QuoteRequest,
  QuoteRequestItem,
  Supplier,
  SupplierAddress,
  Town,
} from "@/lib/types";

/** Flag when a rival is at least this % cheaper on landed line cost. */
export const QUOTE_SAVINGS_ALERT_PCT = 5;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function nameOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = tokenize(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return hit / Math.max(ta.size, tb.length);
}

/** Deterministic rival price factor so other suppliers can undercut / overprice. */
function rivalQuoteFactor(supplierId: string, productId: string): number {
  let h = 0;
  const key = `${supplierId}:${productId}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 0.82 + (h % 41) / 100; // 0.82 … 1.22
}

function pickOrigin(
  supplier: Supplier,
  addresses: SupplierAddress[],
): { town: Town | null; lat: number | null; lng: number | null } {
  const mine = addresses.filter((a) => a.supplier_id === supplier.id);
  const def = mine.find((a) => a.is_default) ?? mine[0];
  return {
    town: def?.town ?? supplier.town,
    lat: def?.lat ?? null,
    lng: def?.lng ?? null,
  };
}

function offerForProduct(
  product: Product,
  qty: number,
  supplier: Supplier,
  addresses: SupplierAddress[],
  hubTown: Town,
  unitPriceOverride?: number,
): QuoteLineMarketOffer {
  const origin = pickOrigin(supplier, addresses);
  const km = distanceToHubKm({
    fromTown: origin.town,
    fromLat: origin.lat,
    fromLng: origin.lng,
    hubTown,
  });
  const unit = unitPriceOverride ?? product.price_kes;
  const line_total_kes = Math.round(unit * qty);
  const transport_kes = estimateTransportKes(km);
  return {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    product_name: product.name,
    unit_price_kes: unit,
    line_total_kes,
    transport_kes,
    landed_line_kes: line_total_kes + transport_kes,
    distance_km: km,
  };
}

/**
 * Find the cheapest landed offer across suppliers for one quote line.
 * Uses real catalog matches plus synthetic rival quotes from other suppliers.
 */
export function findBestOffersForLine(
  item: QuoteRequestItem,
  products: Product[],
  suppliers: Supplier[],
  addresses: SupplierAddress[],
  hubTown: Town,
): QuoteLineMarketOffer[] {
  const query = item.matched_name || item.description;
  const catalogById = new Map(products.map((p) => [p.id, p]));
  const offers: QuoteLineMarketOffer[] = [];

  // Real catalog matches
  for (const product of products) {
    if (!product.is_active || product.stock < 1) continue;
    const score = nameOverlap(query, product.name);
    const exact =
      item.matched_product_id && product.id === item.matched_product_id;
    if (!exact && score < 0.25) continue;
    const supplier = suppliers.find((s) => s.id === product.supplier_id);
    if (!supplier) continue;
    offers.push(
      offerForProduct(product, item.qty, supplier, addresses, hubTown),
    );
  }

  // Synthetic rivals on the matched SKU so other suppliers can compete
  const matched = item.matched_product_id
    ? catalogById.get(item.matched_product_id)
    : null;
  if (matched) {
    for (const supplier of suppliers) {
      if (supplier.id === matched.supplier_id) continue;
      if (offers.some((o) => o.supplier_id === supplier.id)) continue;
      const factor = rivalQuoteFactor(supplier.id, matched.id);
      const unit = Math.max(1, Math.round(matched.price_kes * factor));
      offers.push(
        offerForProduct(
          matched,
          item.qty,
          supplier,
          addresses,
          hubTown,
          unit,
        ),
      );
    }
  }

  return offers.sort((a, b) => a.landed_line_kes - b.landed_line_kes);
}

function analyzeLine(
  item: QuoteRequestItem,
  products: Product[],
  suppliers: Supplier[],
  addresses: SupplierAddress[],
  hubTown: Town,
): QuoteLineAlert {
  const quotedUnit = item.unit_price_kes;
  const quotedLine = item.line_total_kes ?? 0;
  const offers = findBestOffersForLine(
    item,
    products,
    suppliers,
    addresses,
    hubTown,
  );
  const best = offers[0] ?? null;

  if (!item.matched || quotedUnit == null) {
    return {
      description: item.description,
      matched_name: item.matched_name,
      quoted_unit_price_kes: quotedUnit,
      quoted_line_total_kes: quotedLine,
      best_offer: best,
      savings_kes: 0,
      savings_pct: 0,
      is_alert: Boolean(best),
      message: best
        ? `Unmatched line — AI found a possible market offer from ${best.supplier_name} at ${best.unit_price_kes.toLocaleString("en-KE")} KES/unit.`
        : "No catalog match and no competing offer found — needs manual pricing.",
    };
  }

  const quotedSupplierId = products.find(
    (p) => p.id === item.matched_product_id,
  )?.supplier_id;
  const rival =
    best && best.supplier_id !== quotedSupplierId ? best : null;

  // Landed comparison includes inbound transport from rival origin → AMG hub
  const quotedLandedProxy =
    quotedLine + (rival ? rival.transport_kes : 0);
  const savings_kes = rival
    ? Math.max(0, quotedLandedProxy - rival.landed_line_kes)
    : 0;
  const goodsSavings = rival
    ? Math.max(0, quotedLine - rival.line_total_kes)
    : 0;
  const base = Math.max(quotedLandedProxy, 1);
  const savings_pct = Math.round((savings_kes / base) * 1000) / 10;
  const goodsPct = (goodsSavings / Math.max(quotedLine, 1)) * 100;
  const alert =
    Boolean(rival) &&
    (savings_pct >= QUOTE_SAVINGS_ALERT_PCT ||
      goodsPct >= QUOTE_SAVINGS_ALERT_PCT);

  let message: string;
  if (!best) {
    message = "No competing supplier offer found for this line.";
  } else if (alert && rival) {
    message = `${rival.supplier_name} can supply “${rival.product_name}” cheaper (~${Math.max(savings_pct, Math.round(goodsPct * 10) / 10)}% / ${Math.max(savings_kes, goodsSavings).toLocaleString("en-KE")} KES). Current quote may not be best-in-market.`;
  } else {
    message = `Current quote is competitive vs ${best.supplier_name} (${best.unit_price_kes.toLocaleString("en-KE")} KES/unit).`;
  }

  return {
    description: item.description,
    matched_name: item.matched_name,
    quoted_unit_price_kes: quotedUnit,
    quoted_line_total_kes: quotedLine,
    best_offer: rival ?? best,
    savings_kes: Math.round(Math.max(savings_kes, goodsSavings)),
    savings_pct: Math.max(savings_pct, Math.round(goodsPct * 10) / 10),
    is_alert: alert,
    message,
  };
}

export function buildHeuristicQuoteAnalysis(
  quote: Pick<QuoteRequest, "items" | "town" | "total_kes" | "customer_name">,
  products: Product[],
  suppliers: Supplier[],
  addresses: SupplierAddress[] = [],
): QuoteMarketAnalysis {
  const line_alerts = quote.items.map((item) =>
    analyzeLine(item, products, suppliers, addresses, quote.town),
  );
  const alerts = line_alerts.filter((a) => a.is_alert);
  const potential_savings_kes = Math.round(
    alerts.reduce((s, a) => s + a.savings_kes, 0),
  );
  const has_better_prices = alerts.length > 0;

  let summary: string;
  if (has_better_prices) {
    summary = `Market check: ${alerts.length} of ${line_alerts.length} line(s) look overpriced vs other suppliers. Potential savings ~${potential_savings_kes.toLocaleString("en-KE")} KES for ${quote.customer_name} in ${quote.town}. AMG should review before confirming this quote.`;
  } else if (line_alerts.some((a) => !a.quoted_unit_price_kes)) {
    summary = `Some lines need manual pricing. Matched lines look competitive for ${quote.town}.`;
  } else {
    summary = `Current supplier prices look competitive for this quote in ${quote.town}. No better market offer above the ${QUOTE_SAVINGS_ALERT_PCT}% savings threshold.`;
  }

  return {
    analyzed_at: new Date().toISOString(),
    source: "heuristic",
    summary,
    has_better_prices,
    potential_savings_kes,
    line_alerts,
  };
}

/** Merge OpenAI narrative onto a heuristic analysis. */
export function applyAiSummary(
  analysis: QuoteMarketAnalysis,
  summary: string,
): QuoteMarketAnalysis {
  return {
    ...analysis,
    summary: summary.trim() || analysis.summary,
    source: "openai",
    analyzed_at: new Date().toISOString(),
  };
}
