import { NextResponse } from "next/server";
import { addSubscriptionMemory } from "@/lib/push/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireSession } from "@/lib/supabase/route-auth";

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
    // Derive the owner from the caller's real session instead of trusting the
    // client-supplied userId — previously a caller could register their own
    // device under someone else's userId, redirecting that user's future push
    // notifications. (In practice push_subscriptions' RLS `with check
    // (auth.uid() = user_id)` already blocked the cross-user write at the DB
    // layer for any real session — this makes the intent explicit and turns a
    // silent RLS denial into a clear 401 for an unauthenticated caller.)
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }
    const { error } = await session.server.from("push_subscriptions").upsert({
      user_id: session.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // Demo mode (Supabase not configured): purely an ephemeral, per-process,
  // in-memory store with no real user data or RLS behind it — not the
  // vulnerability described in the audit, left as-is.
  addSubscriptionMemory({
    user_id: userId,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    created_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
