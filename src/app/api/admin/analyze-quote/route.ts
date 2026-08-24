import { NextResponse } from "next/server";
import type { QuoteMarketAnalysis } from "@/lib/types";
import { requireAdminSession } from "@/lib/supabase/route-auth";

/**
 * Optional AI narrative on top of heuristic quote market analysis.
 * Without OPENAI_API_KEY, returns the heuristic summary unchanged.
 *
 * Admin-only: this lives under /api/admin/ and spends OPENAI_API_KEY credits
 * on every call, but had no auth check at all. NOTE — src/app/quote/page.tsx
 * (the public buyer-facing quote form) also calls this today, but only in
 * its isDemoMode() branch; its caller (src/lib/quote-ai.ts) already treats a
 * non-ok response as "fall back to the heuristic summary" (`if (!res.ok)
 * return heuristic`), so locking this down doesn't break that page — it
 * just means demo-mode buyers see the heuristic-only summary instead of an
 * AI-refined one for their own quote preview, while admins reviewing the
 * same quote later in /admin/quotes still get the full AI narrative. Real
 * (non-demo) checkout never called this endpoint from that page to begin
 * with.
 */
export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: {
    quoteId?: string;
    customerName?: string;
    town?: string;
    analysis?: QuoteMarketAnalysis;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const analysis = body.analysis;
  if (!analysis) {
    return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
  }

  const fallback = {
    summary: analysis.summary,
    has_better_prices: analysis.has_better_prices,
    potential_savings_kes: analysis.potential_savings_kes,
    source: "heuristic" as const,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallback);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You advise AMG Online Store (Kenya marketplace) when a buyer quote may not use the best supplier prices. Be direct. If has_better_prices is true, tell AMG which lines look overpriced and recommend reviewing suppliers. If false, say prices look competitive. Reply JSON: {\"summary\":\"3-5 sentences for AMG ops\",\"has_better_prices\":boolean}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              quoteId: body.quoteId,
              customerName: body.customerName,
              town: body.town,
              potential_savings_kes: analysis.potential_savings_kes,
              has_better_prices: analysis.has_better_prices,
              line_alerts: analysis.line_alerts.map((a) => ({
                description: a.description,
                matched_name: a.matched_name,
                quoted_unit_price_kes: a.quoted_unit_price_kes,
                is_alert: a.is_alert,
                savings_kes: a.savings_kes,
                savings_pct: a.savings_pct,
                best_supplier: a.best_offer?.supplier_name ?? null,
                best_unit_price_kes: a.best_offer?.unit_price_kes ?? null,
                message: a.message,
              })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return NextResponse.json(fallback);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(fallback);
    const parsed = JSON.parse(content) as {
      summary?: string;
      has_better_prices?: boolean;
    };
    return NextResponse.json({
      summary: parsed.summary?.trim() || fallback.summary,
      has_better_prices:
        typeof parsed.has_better_prices === "boolean"
          ? parsed.has_better_prices
          : fallback.has_better_prices,
      potential_savings_kes: analysis.potential_savings_kes,
      source: "openai" as const,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
