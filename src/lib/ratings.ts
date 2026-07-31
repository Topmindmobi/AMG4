import type {
  RatingDimension,
  RatingScores,
  RatingSubject,
  ServiceRating,
} from "@/lib/types";

export const RATING_SUBJECTS: RatingSubject[] = [
  "delivery",
  "supplier_response",
  "supplier_delivery",
  "goods",
  "rider",
];

export const RATING_DIMENSIONS: RatingDimension[] = [
  "speed",
  "turnaround",
  "quality_of_service",
  "quality_of_goods",
];

export function emptyScores(defaultValue = 0): RatingScores {
  return {
    speed: defaultValue,
    turnaround: defaultValue,
    quality_of_service: defaultValue,
    quality_of_goods: defaultValue,
  };
}

export function averageScores(scores: RatingScores): number {
  const vals = RATING_DIMENSIONS.map((d) => scores[d]).filter((n) => n > 0);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function ratingsForOrder(
  ratings: ServiceRating[],
  orderId: string,
): ServiceRating[] {
  return ratings.filter((r) => r.order_id === orderId);
}

export function orderRatingSummary(ratings: ServiceRating[]): {
  count: number;
  average: number;
  bySubject: Partial<Record<RatingSubject, number>>;
} {
  if (ratings.length === 0) return { count: 0, average: 0, bySubject: {} };
  const bySubject: Partial<Record<RatingSubject, number>> = {};
  for (const r of ratings) bySubject[r.subject] = r.average;
  const average =
    Math.round(
      (ratings.reduce((s, r) => s + r.average, 0) / ratings.length) * 10,
    ) / 10;
  return { count: ratings.length, average, bySubject };
}
