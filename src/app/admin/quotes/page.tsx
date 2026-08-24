"use client";

import { useCallback, useEffect, useState } from "react";
import { formatKes } from "@/lib/format";
import { analyzeQuoteWithAi } from "@/lib/quote-ai";
import { buildHeuristicQuoteAnalysis } from "@/lib/quote-market-analysis";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoProducts,
  getDemoQuoteRequests,
  getDemoSupplierAddresses,
  getDemoSuppliers,
  saveDemoQuoteMarketAnalysis,
} from "@/lib/store/demo-store";
import type { QuoteRequest } from "@/lib/types";

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterAlerts, setFilterAlerts] = useState(false);

  const load = useCallback(() => {
    if (isDemoMode()) {
      setQuotes(getDemoQuoteRequests());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("quote_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setQuotes((data as QuoteRequest[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAiAnalysis(quote: QuoteRequest) {
    if (!isDemoMode()) return;
    setBusyId(quote.id);
    try {
      const products = getDemoProducts({ activeOnly: true });
      const suppliers = getDemoSuppliers();
      const addresses = getDemoSupplierAddresses();
      // Ensure heuristic exists even for older quotes
      const base = quote.market_analysis?.line_alerts?.length
        ? quote
        : {
            ...quote,
            market_analysis: buildHeuristicQuoteAnalysis(
              quote,
              products,
              suppliers,
              addresses,
            ),
          };
      const analysis = await analyzeQuoteWithAi(
        base,
        products,
        suppliers,
        addresses,
      );
      saveDemoQuoteMarketAnalysis(quote.id, analysis);
      load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = filterAlerts
    ? quotes.filter((q) => q.market_analysis?.has_better_prices)
    : quotes;
  const alertCount = quotes.filter((q) => q.market_analysis?.has_better_prices)
    .length;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Quote requests</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Instant building-materials quotes. AI compares supplier prices and alerts
        AMG when the current quote is not the best available.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterAlerts(false)}
          className={`border px-3 py-1.5 text-xs font-medium ${
            !filterAlerts
              ? "border-ember text-ember"
              : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          All ({quotes.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterAlerts(true)}
          className={`border px-3 py-1.5 text-xs font-medium ${
            filterAlerts
              ? "border-ember text-ember"
              : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          Price alerts ({alertCount})
        </button>
      </div>

      <ul className="mt-8 space-y-6">
        {visible.map((q) => {
          const analysis = q.market_analysis;
          return (
            <li key={q.id} className="border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{q.customer_name}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {q.phone} · {q.town}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {q.id} · {new Date(q.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ember">{formatKes(q.total_kes)}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {q.status === "converted" ? "Converted to order" : "Quoted"}
                    {q.unmatched_count > 0
                      ? ` · ${q.unmatched_count} need pricing`
                      : ""}
                  </p>
                  {isDemoMode() && (
                    <button
                      type="button"
                      disabled={busyId === q.id}
                      onClick={() => void runAiAnalysis(q)}
                      className="mt-2 border border-forest px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-50"
                    >
                      {busyId === q.id ? "Analyzing…" : "Analyze with AI"}
                    </button>
                  )}
                </div>
              </div>

              {analysis && (
                <div
                  className={`mt-4 border px-3 py-3 text-sm ${
                    analysis.has_better_prices
                      ? "border-ember/40 bg-ember/10"
                      : "border-forest/30 bg-forest/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-charcoal">
                      {analysis.has_better_prices
                        ? "AI price alert — better quotes available"
                        : "AI market check — competitive"}
                      <span className="ml-2 font-normal normal-case tracking-normal text-ink-soft">
                        ({analysis.source})
                      </span>
                    </p>
                    {analysis.has_better_prices && (
                      <p className="text-xs font-semibold text-ember">
                        Save ~{formatKes(analysis.potential_savings_kes)}
                      </p>
                    )}
                  </div>
                  <p className="mt-2 leading-relaxed text-ink-soft">
                    {analysis.summary}
                  </p>
                  {analysis.line_alerts.some((a) => a.is_alert) && (
                    <ul className="mt-3 space-y-2 border-t border-line/60 pt-3 text-xs">
                      {analysis.line_alerts
                        .filter((a) => a.is_alert)
                        .map((a, i) => (
                          <li key={i} className="text-charcoal">
                            <span className="font-medium">
                              {a.matched_name || a.description}
                            </span>
                            {a.best_offer && (
                              <>
                                {" "}
                                — better via {a.best_offer.supplier_name} at{" "}
                                {formatKes(a.best_offer.unit_price_kes)}/unit
                                (quoted{" "}
                                {a.quoted_unit_price_kes != null
                                  ? formatKes(a.quoted_unit_price_kes)
                                  : "n/a"}
                                )
                              </>
                            )}
                            <span className="mt-0.5 block text-ink-soft">
                              {a.message}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                {q.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span>
                      {item.qty} {item.unit} ×{" "}
                      {item.matched ? item.matched_name : item.description}
                    </span>
                    <span
                      className={item.matched ? "text-ink-soft" : "text-ember"}
                    >
                      {item.matched
                        ? formatKes(item.line_total_kes ?? 0)
                        : "Needs pricing"}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="mt-8 text-sm text-ink-soft">
          {filterAlerts
            ? "No price alerts right now."
            : "No quote requests yet."}
        </p>
      )}
    </div>
  );
}
