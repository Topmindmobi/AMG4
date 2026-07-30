"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AccountPage() {
  const { user, email, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login?next=/account");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading account…</div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Account</h1>
      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-ink-soft">Name</dt>
          <dd className="text-lg font-semibold">{user.full_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Email</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Phone</dt>
          <dd>{user.phone || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Role</dt>
          <dd className="capitalize">{user.role}</dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/account/orders"
          className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white hover:bg-ember-deep"
        >
          My orders
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="rounded-lg border-[1.5px] border-forest px-5 py-2.5 text-sm font-semibold text-forest"
          >
            Admin console
          </Link>
        )}
      </div>
    </div>
  );
}
