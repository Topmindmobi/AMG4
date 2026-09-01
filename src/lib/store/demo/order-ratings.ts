"use client";

/**
 * Demo-mode customer order ratings (overall + delivery + per-product).
 * Part of the `demo-store.ts` module split — see that file. Mirrors the
 * upsert shape of the production `submit_order_rating` RPC (031_...sql):
 * one row per order in `order_ratings`, one row per (order_item, user) in
 * `product_ratings`, both editable after first submit.
 */

import type { OrderRating, ProductRating } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";
import { getDemoOrder } from "./orders";

export function getDemoOrderRating(orderId: string): OrderRating | null {
  ensureSeeded();
  return read<OrderRating[]>(KEYS.orderRatings, []).find((r) => r.order_id === orderId) ?? null;
}

export function getDemoProductRatings(orderId: string): ProductRating[] {
  ensureSeeded();
  return read<ProductRating[]>(KEYS.productRatings, []).filter((r) => r.order_id === orderId);
}

export function submitDemoOrderRating(input: {
  orderId: string;
  userId: string;
  overallRating: number;
  deliveryRating: number;
  reviewText?: string | null;
  productRatings: { orderItemId: string; rating: number; reviewText?: string | null }[];
}): OrderRating {
  ensureSeeded();
  const order = getDemoOrder(input.orderId);
  if (!order) throw new Error("Order not found");
  if (order.user_id !== input.userId) throw new Error("Not your order");
  if (order.status !== "delivered") throw new Error("Order must be delivered before it can be rated");
  if (input.overallRating < 1 || input.overallRating > 5 || input.deliveryRating < 1 || input.deliveryRating > 5) {
    throw new Error("Ratings must be 1-5");
  }

  const now = new Date().toISOString();
  const orderRatings = read<OrderRating[]>(KEYS.orderRatings, []);
  const existing = orderRatings.find((r) => r.order_id === input.orderId);
  const rating: OrderRating = {
    id: existing?.id ?? `orate-${Date.now()}`,
    order_id: input.orderId,
    user_id: input.userId,
    overall_rating: input.overallRating,
    delivery_rating: input.deliveryRating,
    review_text: input.reviewText?.trim() || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  write(
    KEYS.orderRatings,
    existing
      ? orderRatings.map((r) => (r.order_id === input.orderId ? rating : r))
      : [rating, ...orderRatings],
  );

  const validItemIds = new Set((order.items ?? []).map((i) => i.id));
  const productRatings = read<ProductRating[]>(KEYS.productRatings, []);
  let nextProductRatings = productRatings.filter((r) => r.order_id !== input.orderId);
  for (const pr of input.productRatings) {
    if (!validItemIds.has(pr.orderItemId)) {
      throw new Error(`Item ${pr.orderItemId} does not belong to this order`);
    }
    const item = order.items?.find((i) => i.id === pr.orderItemId);
    const existingPr = productRatings.find(
      (r) => r.order_item_id === pr.orderItemId && r.user_id === input.userId,
    );
    nextProductRatings = [
      ...nextProductRatings,
      {
        id: existingPr?.id ?? `prate-${Date.now()}-${pr.orderItemId}`,
        order_id: input.orderId,
        order_item_id: pr.orderItemId,
        product_id: item?.product_id ?? null,
        user_id: input.userId,
        rating: pr.rating,
        review_text: pr.reviewText?.trim() || null,
        created_at: existingPr?.created_at ?? now,
        updated_at: now,
      },
    ];
  }
  write(KEYS.productRatings, nextProductRatings);

  return rating;
}
