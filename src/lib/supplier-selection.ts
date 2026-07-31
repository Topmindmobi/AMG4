import {
  distanceScoreFromKm,
  distanceToHubKm,
  estimateTransportKes,
} from "@/lib/geo";
import type {
  Order,
  OrderItem,
  Product,
  Supplier,
  SupplierAddress,
} from "@/lib/types";

export type MatchedLine = {
  orderItem: OrderItem;
  product: Product | null;
  availableQty: number;
  unitPrice: number;
  lineTotal: number;
  covered: boolean;
};

export type SupplierScorecard = {
  supplier: Supplier;
  rank: number;
  /** 0–100 composite: best value for money (landed cost + stock + distance) */
  valueScore: number;
  availabilityScore: number;
  priceScore: number;
  distanceScore: number;
  distanceKm: number;
  /** Goods quote only */
  quoteKes: number;
  /** Estimated inbound transport supplier → AMG hub for the order town */
  transportKes: number;
  /** quote + transport — used for price scoring */
  landedKes: number;
  /** Address used for the distance calculation */
  originLabel: string;
  coveredLines: number;
  totalLines: number;
  coveragePct: number;
  matches: MatchedLine[];
  isRecommended: boolean;
};

export type SupplierSelectionResult = {
  scorecards: SupplierScorecard[];
  recommended: SupplierScorecard | null;
  rationale: string;
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function nameOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return hit / Math.max(ta.size, tb.length);
}

/** Deterministic ±% quote variance so rival suppliers can be compared on the same SKU. */
function rivalQuoteFactor(supplierId: string, productId: string): number {
  let h = 0;
  const key = `${supplierId}:${productId}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  // 0.88 … 1.18
  return 0.88 + (h % 31) / 100;
}

/**
 * Best catalog match a supplier can offer for one order line.
 * If they don't stock an equivalent, we still build a competitive quote off the
 * original SKU (price/stock adjusted) so admins can compare value across suppliers.
 */
export function matchSupplierProduct(
  item: OrderItem,
  supplierProducts: Product[],
  catalogById: Map<string, Product>,
  supplierId?: string,
): Product | null {
  const original = item.product_id ? catalogById.get(item.product_id) : undefined;
  if (original && original.supplier_id && supplierProducts.some((p) => p.id === original.id)) {
    return original;
  }

  const categoryId = original?.category_id;
  const sameCategory = categoryId
    ? supplierProducts.filter((p) => p.category_id === categoryId && p.is_active)
    : [];

  const pool = sameCategory.length > 0 ? sameCategory : supplierProducts.filter((p) => p.is_active);

  let best: Product | null = null;
  let bestScore = 0;
  for (const p of pool) {
    let score = nameOverlap(item.name_snapshot, p.name);
    if (categoryId && p.category_id === categoryId) score += 0.35;
    if (original && p.id === original.id) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (best && (bestScore >= 0.25 || (original && best.id === original.id))) {
    return best;
  }

  // Competitive quote from a rival supplier on the same ordered SKU
  if (original && supplierId && original.supplier_id !== supplierId) {
    const factor = rivalQuoteFactor(supplierId, original.id);
    const stockBoost = Math.max(0, Math.round(original.stock * (0.6 + (factor - 0.88))));
    return {
      ...original,
      id: `${original.id}__offer__${supplierId}`,
      supplier_id: supplierId,
      price_kes: Math.max(1, Math.round(original.price_kes * factor)),
      stock: Math.max(item.qty, stockBoost),
      name: original.name,
    };
  }

  return best;
}

function pickOriginAddress(
  supplier: Supplier,
  addresses: SupplierAddress[],
): SupplierAddress | null {
  const mine = addresses.filter((a) => a.supplier_id === supplier.id);
  if (mine.length === 0) return null;
  return mine.find((a) => a.is_default) ?? mine[0];
}

function buildMatches(
  order: Order,
  supplier: Supplier,
  products: Product[],
  catalogById: Map<string, Product>,
): MatchedLine[] {
  const theirs = products.filter((p) => p.supplier_id === supplier.id);
  const items = order.items ?? [];
  return items.map((orderItem) => {
    const product = matchSupplierProduct(orderItem, theirs, catalogById, supplier.id);
    if (!product) {
      return {
        orderItem,
        product: null,
        availableQty: 0,
        unitPrice: orderItem.price_kes,
        lineTotal: 0,
        covered: false,
      };
    }
    const availableQty = Math.min(product.stock, orderItem.qty);
    const covered = availableQty >= orderItem.qty && product.stock > 0;
    const unitPrice = product.price_kes;
    return {
      orderItem,
      product,
      availableQty,
      unitPrice,
      lineTotal: unitPrice * orderItem.qty,
      covered: covered || availableQty > 0,
    };
  });
}

function scoreSupplier(
  order: Order,
  supplier: Supplier,
  products: Product[],
  catalogById: Map<string, Product>,
  addresses: SupplierAddress[],
): Omit<SupplierScorecard, "rank" | "priceScore" | "valueScore" | "isRecommended"> {
  const matches = buildMatches(order, supplier, products, catalogById);
  const totalLines = matches.length || 1;
  const coveredLines = matches.filter((m) => m.covered).length;
  const qtyNeeded = matches.reduce((s, m) => s + m.orderItem.qty, 0) || 1;
  const qtyAvailable = matches.reduce((s, m) => s + m.availableQty, 0);
  const availabilityScore = Math.round(Math.min(100, (qtyAvailable / qtyNeeded) * 100));
  const quoteKes = matches.reduce(
    (s, m) => s + (m.covered || m.availableQty > 0 ? m.lineTotal : 0),
    0,
  );

  const origin = pickOriginAddress(supplier, addresses);
  const fromTown = origin?.town ?? supplier.town;
  const km = distanceToHubKm({
    fromTown,
    fromLat: origin?.lat ?? null,
    fromLng: origin?.lng ?? null,
    hubTown: order.town,
  });
  const transportKes = estimateTransportKes(km);
  const landedKes = quoteKes + transportKes;
  const distanceScoreValue = distanceScoreFromKm(km);
  const coveragePct = Math.round((coveredLines / totalLines) * 100);
  const originLabel = origin
    ? `${origin.name} (${origin.town})`
    : fromTown
      ? `Town only (${fromTown})`
      : "No address set";

  return {
    supplier,
    availabilityScore,
    distanceScore: distanceScoreValue,
    distanceKm: km,
    quoteKes,
    transportKes,
    landedKes,
    originLabel,
    coveredLines,
    totalLines: matches.length,
    coveragePct,
    matches,
  };
}

/** Deterministic “AI” pick: highest value score, with a short rationale admins can read. */
export function buildSelectionRationale(
  recommended: SupplierScorecard,
  all: SupplierScorecard[],
): string {
  if (!recommended) return "No supplier can fulfill this order yet.";
  const others = all.filter((s) => s.supplier.id !== recommended.supplier.id);
  const cheaperGoods = others.find(
    (s) => s.quoteKes > 0 && s.quoteKes < recommended.quoteKes,
  );
  const cheaperLanded = others.find(
    (s) => s.landedKes > 0 && s.landedKes < recommended.landedKes,
  );
  const nearer = others.find((s) => s.distanceKm < recommended.distanceKm);
  const parts = [
    `Recommended ${recommended.supplier.name} (value ${recommended.valueScore}/100).`,
    `Availability ${recommended.availabilityScore}/100 covers ${recommended.coveredLines}/${recommended.totalLines} lines.`,
    `Goods ${recommended.quoteKes.toLocaleString("en-KE")} KES + transport ~${recommended.transportKes.toLocaleString("en-KE")} KES = landed ${recommended.landedKes.toLocaleString("en-KE")} KES.`,
    `~${recommended.distanceKm} km from ${recommended.originLabel} to the AMG hub serving the customer.`,
  ];
  if (cheaperGoods && !cheaperLanded) {
    parts.push(
      `${cheaperGoods.supplier.name} quotes less on goods, but higher transport makes their landed cost worse.`,
    );
  } else if (cheaperLanded) {
    parts.push(
      `${cheaperLanded.supplier.name} has a lower landed cost on paper but scores lower on availability or distance blend.`,
    );
  } else if (nearer) {
    parts.push(
      `${nearer.supplier.name} is closer but cannot match price or stock coverage as well.`,
    );
  } else {
    parts.push("No other supplier beats this blend of stock, landed cost, and distance.");
  }
  return parts.join(" ");
}

/**
 * Rank every supplier for an order: best value for money first.
 * Value = 40% landed price (goods + transport) + 40% availability + 20% distance.
 */
export function rankSuppliersForOrder(
  order: Order,
  suppliers: Supplier[],
  products: Product[],
  addresses: SupplierAddress[] = [],
): SupplierSelectionResult {
  const catalogById = new Map(products.map((p) => [p.id, p]));
  const raw = suppliers.map((s) =>
    scoreSupplier(order, s, products, catalogById, addresses),
  );

  const landeds = raw.map((v) => v.landedKes).filter((q) => q > 0);
  const minLanded = landeds.length ? Math.min(...landeds) : 0;
  const maxLanded = landeds.length ? Math.max(...landeds) : 0;

  const scored: SupplierScorecard[] = raw
    .map((v) => {
      let priceScore = 50;
      if (v.landedKes <= 0) priceScore = 0;
      else if (maxLanded === minLanded) priceScore = 100;
      else {
        // Lower landed cost → higher score
        priceScore = Math.round(
          100 * ((maxLanded - v.landedKes) / (maxLanded - minLanded)),
        );
      }
      const valueScore = Math.round(
        priceScore * 0.4 + v.availabilityScore * 0.4 + v.distanceScore * 0.2,
      );
      return {
        ...v,
        priceScore,
        valueScore,
        rank: 0,
        isRecommended: false,
      };
    })
    .sort((a, b) => {
      if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
      if (b.availabilityScore !== a.availabilityScore)
        return b.availabilityScore - a.availabilityScore;
      return a.landedKes - b.landedKes;
    })
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const bestViableIdx = scored.findIndex(
    (s) => s.coveredLines > 0 && s.availabilityScore > 0,
  );
  const recommendIdx = bestViableIdx >= 0 ? bestViableIdx : 0;
  if (scored[recommendIdx]) {
    scored[recommendIdx] = { ...scored[recommendIdx], isRecommended: true };
    if (recommendIdx !== 0) {
      const [picked] = scored.splice(recommendIdx, 1);
      scored.unshift(picked);
      scored.forEach((s, i) => {
        s.rank = i + 1;
      });
    }
  }
  const recommended = scored[0] ?? null;

  return {
    scorecards: scored,
    recommended,
    rationale: recommended
      ? buildSelectionRationale(recommended, scored)
      : "No suppliers available.",
  };
}

/** Optional remote AI refinement — falls back to local ranking when unavailable. */
export async function refineSelectionWithAi(
  order: Order,
  local: SupplierSelectionResult,
): Promise<SupplierSelectionResult> {
  try {
    const res = await fetch("/api/admin/select-supplier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        customerTown: order.town,
        scorecards: local.scorecards.map((s) => ({
          supplierId: s.supplier.id,
          name: s.supplier.name,
          town: s.supplier.town,
          originLabel: s.originLabel,
          valueScore: s.valueScore,
          availabilityScore: s.availabilityScore,
          priceScore: s.priceScore,
          distanceScore: s.distanceScore,
          distanceKm: s.distanceKm,
          quoteKes: s.quoteKes,
          transportKes: s.transportKes,
          landedKes: s.landedKes,
          coveragePct: s.coveragePct,
        })),
      }),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as {
      supplierId?: string;
      rationale?: string;
    };
    if (!data.supplierId) return local;
    const picked = local.scorecards.find((s) => s.supplier.id === data.supplierId);
    if (!picked) return local;
    const scorecards = local.scorecards.map((s) => ({
      ...s,
      isRecommended: s.supplier.id === data.supplierId,
      rank: s.supplier.id === data.supplierId ? 1 : s.rank === 1 ? 2 : s.rank,
    }));
    scorecards.sort((a, b) => {
      if (a.isRecommended) return -1;
      if (b.isRecommended) return 1;
      return a.rank - b.rank;
    });
    scorecards.forEach((s, i) => {
      s.rank = i + 1;
    });
    return {
      scorecards,
      recommended: scorecards[0] ?? null,
      rationale: data.rationale?.trim() || local.rationale,
    };
  } catch {
    return local;
  }
}
