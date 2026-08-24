"use client";

/**
 * Demo-mode post-delivery service ratings. Part of the `demo-store.ts`
 * module split — see that file. Named `service-ratings.ts` (not `ratings.ts`)
 * to avoid confusion with the unrelated `@/lib/ratings.ts` (rating-average
 * math shared with production), which this module imports from.
 */

import { averageScores } from "@/lib/ratings";
import type { RatingScores, RatingSubject, ServiceRating } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";

export function getDemoServiceRatings(orderId?: string): ServiceRating[] {
  ensureSeeded();
  const list = read<ServiceRating[]>(KEYS.serviceRatings, []);
  const filtered = orderId ? list.filter((r) => r.order_id === orderId) : list;
  return filtered.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function upsertDemoServiceRating(input: {
  id?: string;
  order_id: string;
  subject: RatingSubject;
  scores: RatingScores;
  notes?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  rider_id?: string | null;
  rider_name?: string | null;
  created_by?: string | null;
}): ServiceRating {
  ensureSeeded();
  const list = read<ServiceRating[]>(KEYS.serviceRatings, []);
  const average = averageScores(input.scores);

  if (input.id) {
    const next = list.map((r) =>
      r.id === input.id
        ? {
            ...r,
            scores: input.scores,
            average,
            notes: input.notes?.trim() || null,
            supplier_id: input.supplier_id ?? r.supplier_id,
            supplier_name: input.supplier_name ?? r.supplier_name,
            rider_id: input.rider_id ?? r.rider_id,
            rider_name: input.rider_name ?? r.rider_name,
          }
        : r,
    );
    write(KEYS.serviceRatings, next);
    return next.find((r) => r.id === input.id)!;
  }

  // One rating per subject per order — replace if exists
  const without = list.filter(
    (r) => !(r.order_id === input.order_id && r.subject === input.subject),
  );
  const rating: ServiceRating = {
    id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    order_id: input.order_id,
    subject: input.subject,
    supplier_id: input.supplier_id ?? null,
    supplier_name: input.supplier_name ?? null,
    rider_id: input.rider_id ?? null,
    rider_name: input.rider_name ?? null,
    scores: input.scores,
    average,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    created_by: input.created_by ?? null,
  };
  write(KEYS.serviceRatings, [rating, ...without]);
  return rating;
}
