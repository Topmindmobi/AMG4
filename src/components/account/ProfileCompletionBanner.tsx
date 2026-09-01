"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isProfileComplete } from "@/lib/profile";

const SKIP_PREFIXES = ["/auth", "/admin", "/supplier", "/rider"];

/** Persistent reminder, distinct from ProfileCompletionGate's one-time redirect — keeps
 * nagging (ignores profile_prompt_shown_at) until the profile is actually complete. */
export function ProfileCompletionBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user || user.role === "admin") return null;
  if (pathname === "/account/profile") return null;
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (isProfileComplete(user)) return null;

  return (
    <div className="border-b border-line bg-ember/10 px-5 py-2.5 text-center text-sm text-charcoal">
      Your profile is missing some delivery details.{" "}
      <Link href="/account/profile" className="font-semibold text-ember underline">
        Complete your profile
      </Link>
    </div>
  );
}
