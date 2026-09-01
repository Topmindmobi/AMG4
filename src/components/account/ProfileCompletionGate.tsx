"use client";

/**
 * Renders nothing — mounted once globally. Redirects a signed-in user to
 * /account/profile exactly once (ever) if their profile is incomplete,
 * satisfying the "soft prompt: redirect once, skippable" requirement. The
 * persistent nag after that is ProfileCompletionBanner, which is driven by
 * completeness alone and ignores profile_prompt_shown_at.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isProfileComplete } from "@/lib/profile";
import { isDemoMode } from "@/lib/supabase/config";
import { markDemoProfilePromptShown } from "@/lib/store/demo-store";

const SKIP_PREFIXES = ["/auth", "/admin", "/supplier", "/rider"];

export function ProfileCompletionGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "admin") return;
    if (pathname === "/account/profile") return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (user.profile_prompt_shown_at) return;
    if (isProfileComplete(user)) return;

    if (isDemoMode()) {
      markDemoProfilePromptShown(user.id);
    } else {
      void (async () => {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({ profile_prompt_shown_at: new Date().toISOString() })
          .eq("id", user.id)
          .is("profile_prompt_shown_at", null);
      })();
    }
    router.replace(`/account/profile?prompt=complete-profile&next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, router]);

  return null;
}
