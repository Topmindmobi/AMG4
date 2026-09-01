"use client";

/**
 * Renders nothing — mounted once globally. Hard-redirects a signed-in,
 * non-admin user to /account/choose-role whenever they have neither a
 * role_applications row (i.e. never chose rider/seller) nor a complete
 * base profile (i.e. never completed the buyer path either) — the very
 * first thing a new signup sees. No skip: this fires on every navigation
 * until one of those two conditions is met. Already-onboarded accounts
 * (complete profile, or any role_applications row, or already
 * supplier/rider/admin) are exempt and never see this.
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isProfileComplete } from "@/lib/profile";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoRoleApplications } from "@/lib/store/demo-store";

const SKIP_PREFIXES = [
  "/auth",
  "/admin",
  "/supplier",
  "/rider",
  "/account/choose-role",
  "/account/profile",
  "/account/become-supplier",
  "/account/become-rider",
];

export function ProfileCompletionGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hasApplication, setHasApplication] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasApplication(null);
      return;
    }
    if (isDemoMode()) {
      setHasApplication(getDemoRoleApplications(user.id).length > 0);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("role_applications")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      setHasApplication((data?.length ?? 0) > 0);
    })();
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "admin") return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (hasApplication === null) return; // still resolving — avoid a false redirect
    if (hasApplication) return; // already chose rider/seller, in the pipeline
    if (isProfileComplete(user)) return; // already completed the buyer path

    router.replace(`/account/choose-role?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, hasApplication, router]);

  return null;
}
