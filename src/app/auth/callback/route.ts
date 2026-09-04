import { NextResponse } from "next/server";
import { roleHomePath } from "@/lib/auth-context";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile } from "@/lib/types";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/account";
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_unavailable`);
  }

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // "/account" is the generic fallback every caller defaults to when it
      // has no specific place to send the user — treat it as "no
      // preference" and route admin/supplier/rider straight to their own
      // dashboard instead, same as the email/password login flow already
      // does. A genuine deep link (e.g. "sign in to leave a review") is
      // always respected as-is.
      if (next === "/account" && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();
        return NextResponse.redirect(`${origin}${roleHomePath(profile as Profile | null)}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
}
