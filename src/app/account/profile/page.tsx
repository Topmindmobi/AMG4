"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileForm } from "@/components/account/ProfileForm";
import { useAuth } from "@/lib/auth-context";

function ProfilePageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login?next=/account/profile");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading…</div>;
  }

  const prompted = search.get("prompt") === "complete-profile";
  const rawNext = search.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Account</p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,36px)] text-charcoal">
        {prompted ? "Complete your profile" : "Edit profile"}
      </h1>
      {prompted && (
        <p className="mt-3 rounded-lg border-[1.5px] border-line bg-sand px-4 py-3 text-sm text-charcoal">
          Add your delivery details so AMG can reach you. You can skip this for now and finish it
          later from your account page.
        </p>
      )}
      <ProfileForm showSkip={prompted} next={next} />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
