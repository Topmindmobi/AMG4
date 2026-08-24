"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export type GuardedRole = "admin" | "supplier" | "rider";

const ROLE_MATCH_KEY: Record<GuardedRole, "isAdmin" | "isSupplier" | "isRider"> = {
  admin: "isAdmin",
  supplier: "isSupplier",
  rider: "isRider",
};

/**
 * Shared auth-guard for the admin/supplier/rider dashboard shells: redirects
 * to login if there's no session, or away from the portal if the signed-in
 * user's role doesn't match. Mirrors the per-shell logic that used to be
 * duplicated across AdminShell/SupplierShell/RiderShell:
 *  - no user -> `/auth/login?next=/<role>`
 *  - wrong role, but the user is an admin (and this isn't the admin portal)
 *    -> `/admin` (admins can always reach their own portal)
 *  - wrong role otherwise -> `/account`
 *
 * `ready` is true only once loading is finished, a user is present, and the
 * role matches — the same condition each shell previously used to decide
 * whether to render its loading fallback vs. the real content.
 */
export function useRoleGuard(role: GuardedRole) {
  const auth = useAuth();
  const { user, loading } = auth;
  const isMatch = auth[ROLE_MATCH_KEY[role]];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/auth/login?next=/${role}`);
      return;
    }
    if (!isMatch) {
      router.replace(user.role === "admin" && role !== "admin" ? "/admin" : "/account");
    }
  }, [user, loading, isMatch, role, router]);

  return {
    user,
    loading,
    isMatch,
    ready: !loading && !!user && isMatch,
  };
}
