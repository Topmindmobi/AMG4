import {
  applyAiSummary,
  buildHeuristicQuoteAnalysis,
} from "@/lib/quote-market-analysis";
import type {
  Product,
  QuoteMarketAnalysis,
  QuoteRequest,
  Supplier,
  SupplierAddress,
} from "@/lib/types";

/** Local market scan + optional OpenAI narrative for AMG. */
export async function analyzeQuoteWithAi(
  quote: QuoteRequest,
  products: Product[],
  suppliers: Supplier[],
  addresses: SupplierAddress[] = [],
): Promise<QuoteMarketAnalysis> {
  const heuristic = buildHeuristicQuoteAnalysis(
    quote,
    products,
    suppliers,
    addresses,
  );

  try {
    const res = await fetch("/api/admin/analyze-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: quote.id,
        customerName: quote.customer_name,
        town: quote.town,
        analysis: heuristic,
      }),
    });
    if (!res.ok) return heuristic;
    const data = (await res.json()) as {
      summary?: string;
      has_better_prices?: boolean;
      source?: "heuristic" | "openai";
    };
    if (!data.summary) return heuristic;
    const withAi = applyAiSummary(heuristic, data.summary);
    if (typeof data.has_better_prices === "boolean") {
      withAi.has_better_prices = data.has_better_prices;
    }
    return withAi;
  } catch {
    return heuristic;
  }
}
