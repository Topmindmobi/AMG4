import { NextResponse } from "next/server";

type ScorecardIn = {
  supplierId: string;
  name: string;
  town: string | null;
  valueScore: number;
  availabilityScore: number;
  priceScore: number;
  distanceScore: number;
  quoteKes: number;
  coveragePct: number;
};

/**
 * Optional AI refinement for supplier pick.
 * Without OPENAI_API_KEY, returns the top local value-for-money supplier.
 */
export async function POST(req: Request) {
  let body: {
    orderId?: string;
    customerTown?: string;
    scorecards?: ScorecardIn[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cards = [...(body.scorecards ?? [])].sort((a, b) => b.valueScore - a.valueScore);
  if (cards.length === 0) {
    return NextResponse.json({ error: "No scorecards" }, { status: 400 });
  }

  const fallback = {
    supplierId: cards[0].supplierId,
    rationale: `${cards[0].name} ranks best on value for money (${cards[0].valueScore}/100) for a customer in ${body.customerTown ?? "the delivery town"} — balancing availability (${cards[0].availabilityScore}), price (${cards[0].priceScore}), and distance (${cards[0].distanceScore}).`,
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
              "You pick the best supplier for an AMG marketplace order in Kenya. Prefer best overall value for money using availability, price, and distance scores. Reply JSON: {\"supplierId\":\"...\",\"rationale\":\"2-3 sentences\"}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              customerTown: body.customerTown,
              orderId: body.orderId,
              suppliers: cards,
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
    const parsed = JSON.parse(content) as { supplierId?: string; rationale?: string };
    if (!parsed.supplierId || !cards.some((c) => c.supplierId === parsed.supplierId)) {
      return NextResponse.json(fallback);
    }
    return NextResponse.json({
      supplierId: parsed.supplierId,
      rationale: parsed.rationale || fallback.rationale,
      source: "openai" as const,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
