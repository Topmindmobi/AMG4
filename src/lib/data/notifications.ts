import { getDemoNotifications, markDemoNotificationRead } from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";
import type { AppNotification } from "@/lib/types";

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  if (isDemoMode()) return getDemoNotifications(userId);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as AppNotification[]) ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isDemoMode()) {
    markDemoNotificationRead(id);
    return;
  }
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}
