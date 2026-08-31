"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RoleApplicationForm } from "@/components/account/RoleApplicationForm";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoRoleApplications } from "@/lib/store/demo-store";
import type { RoleApplication, RoleApplicationType } from "@/lib/types";

const COPY: Record<RoleApplicationType, { title: string; blurb: string }> = {
  supplier: {
    title: "Become a supplier",
    blurb:
      "List your products on AMG Online Store. We'll review your details and KYC documents before activating your supplier account.",
  },
  rider: {
    title: "Become a rider",
    blurb:
      "Deliver orders for AMG Online Store. We'll review your details and KYC documents before activating your rider account.",
  },
};

export function RoleApplicationPage({ type }: { type: RoleApplicationType }) {
  const { user, email, loading } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<RoleApplication | null | undefined>(undefined);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/auth/login?next=/account/become-${type}`);
    }
  }, [loading, user, router, type]);

  useEffect(() => {
    if (!user) return;
    if (isDemoMode()) {
      const apps = getDemoRoleApplications(user.id).filter((a) => a.type === type);
      setApplication(apps[0] ?? null);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("role_applications")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication((data as RoleApplication) ?? null);
    })();
  }, [user, type]);

  if (loading || !user || application === undefined) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading…</div>;
  }

  const alreadyThisRole = (type === "supplier" && user.role === "supplier") || (type === "rider" && user.role === "rider");
  const { title, blurb } = COPY[type];

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{blurb}</p>

      {alreadyThisRole ? (
        <p className="mt-8 rounded-lg border-[1.5px] border-forest/30 bg-forest/5 px-4 py-3 text-sm text-charcoal">
          Your account is already an approved {type}.
        </p>
      ) : application && application.status === "pending" ? (
        <p className="mt-8 rounded-lg border-[1.5px] border-line bg-sand px-4 py-3 text-sm text-charcoal">
          Your application is under review. We'll email you once it's decided.
        </p>
      ) : application && application.status === "approved" ? (
        <p className="mt-8 rounded-lg border-[1.5px] border-forest/30 bg-forest/5 px-4 py-3 text-sm text-charcoal">
          Your application was approved — refresh the page or sign in again to access your {type} dashboard.
        </p>
      ) : (
        <>
          {application && application.status === "rejected" && (
            <p className="mt-8 rounded-lg border-[1.5px] border-ember/40 bg-ember/10 px-4 py-3 text-sm text-charcoal">
              Your previous application wasn't approved
              {application.rejection_reason ? `: ${application.rejection_reason}` : "."} You can apply again below.
            </p>
          )}
          <RoleApplicationForm
            type={type}
            userId={user.id}
            email={email ?? ""}
            onSubmitted={setApplication}
          />
        </>
      )}
    </div>
  );
}
