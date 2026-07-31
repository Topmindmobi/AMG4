import { NextResponse } from "next/server";
import { addSubscriptionMemory } from "@/lib/push/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, endpoint, keys } = body;
  if (!userId || !endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { ok: false, error: "Required: userId, endpoint, keys.p256dh, keys.auth" },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  addSubscriptionMemory({
    user_id: userId,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    created_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
