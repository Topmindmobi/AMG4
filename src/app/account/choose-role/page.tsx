"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isProfileComplete } from "@/lib/profile";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoRoleApplications } from "@/lib/store/demo-store";

type RoleChoice = "buyer" | "rider" | "seller";

const CARDS: { value: RoleChoice; title: string; blurb: string }[] = [
  { value: "buyer", title: "I'm here to buy", blurb: "Shop products with nationwide delivery." },
  { value: "rider", title: "I'm here to deliver", blurb: "Deliver orders and earn per delivery." },
  {
    value: "seller",
    title: "I'm here to sell",
    blurb: "List your products and reach customers nationwide.",
  },
];

function ChooseRoleInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [hasApplication, setHasApplication] = useState<boolean | null>(null);

  const rawNext = search.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login?next=/account/choose-role");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
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
    if (!user || hasApplication === null) return;
    const alreadyResolved =
      user.role === "admin" ||
      user.role === "supplier" ||
      user.role === "rider" ||
      hasApplication ||
      isProfileComplete(user);
    if (alreadyResolved) router.replace(next);
  }, [user, hasApplication, next, router]);

  if (loading || !user || hasApplication === null) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading…</div>;
  }

  function choose(value: RoleChoice) {
    if (value === "buyer") {
      router.push(`/account/profile?prompt=complete-profile&next=${encodeURIComponent(next)}`);
    } else if (value === "rider") {
      router.push("/account/become-rider");
    } else {
      router.push("/account/become-supplier");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Welcome to AMG</p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,36px)] text-charcoal">
        What brings you here?
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Tell us how you'll use AMG so we can get you set up.
      </p>

      <div className="mt-8 grid gap-4">
        {CARDS.map((card) => (
          <button
            key={card.value}
            type="button"
            onClick={() => choose(card.value)}
            className="rounded-lg border-[1.5px] border-line bg-white px-5 py-4 text-left hover:border-forest"
          >
            <p className="font-display text-lg text-charcoal">{card.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{card.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChooseRolePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading…</div>}>
      <ChooseRoleInner />
    </Suspense>
  );
}
