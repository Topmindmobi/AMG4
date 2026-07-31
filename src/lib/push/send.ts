import "server-only";
import webpush from "web-push";
import { getSubscriptionsMemory } from "@/lib/push/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PushSubscriptionRecord } from "@/lib/types";

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@amg.com",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
}

export type SendPushResult = { sent: number; failed: number; skipped?: string };

/**
 * Push a notification to every device `userId` has subscribed from. Never
 * throws — soft-fails like SMS/email when push isn't configured or a
 * subscription has expired.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<SendPushResult> {
  if (!isPushConfigured()) {
    const reason = "Push not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)";
    console.warn(`[push] skipped: ${reason}`);
    return { sent: 0, failed: 0, skipped: reason };
  }
  ensureConfigured();

  let subs: PushSubscriptionRecord[];
  if (isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
    subs = (data ?? []) as PushSubscriptionRecord[];
  } else {
    subs = getSubscriptionsMemory(userId);
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      failed++;
      console.error(`[push] send failed for ${userId}:`, err instanceof Error ? err.message : err);
    }
  }
  if (subs.length === 0) {
    console.info(`[push] no subscriptions for user ${userId} — in-app notification is the fallback`);
  }
  return { sent, failed };
}
