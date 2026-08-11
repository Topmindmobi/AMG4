"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/supabase/errors";

export default function AccountPage() {
  const { user, email, loading, isAdmin, deleteAccount } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      router.push("/");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Could not delete account"));
      setDeleting(false);
    }
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

      <div className="mt-12 border-t border-line pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Delete account
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Permanently deletes your login and profile. Past orders are kept as business
          records but are no longer linked to you.
        </p>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-4 rounded-lg border-[1.5px] border-ember px-5 py-2.5 text-sm font-semibold text-ember hover:bg-ember/5"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-4 max-w-sm space-y-3 rounded-lg border-[1.5px] border-ember/40 bg-ember/5 p-4">
            <p className="text-sm font-semibold text-charcoal">
              This can&apos;t be undone. Type DELETE to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ember"
            />
            {deleteError && <p className="text-sm text-ember">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={() => void handleDelete()}
                className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setDeleteError(null);
                }}
                className="rounded-lg border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-charcoal"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
