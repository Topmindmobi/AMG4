import "server-only";
import type { PushSubscriptionRecord } from "@/lib/types";

/**
 * In-memory fallback used in demo mode (no Supabase project to persist to).
 * Production (Supabase configured) writes to the push_subscriptions table
 * instead — see send.ts.
 */
const memory = new Map<string, PushSubscriptionRecord[]>();

export function addSubscriptionMemory(sub: PushSubscriptionRecord) {
  const list = memory.get(sub.user_id) ?? [];
  if (!list.some((s) => s.endpoint === sub.endpoint)) {
    memory.set(sub.user_id, [...list, sub]);
  }
}

export function getSubscriptionsMemory(userId: string): PushSubscriptionRecord[] {
  return memory.get(userId) ?? [];
}
