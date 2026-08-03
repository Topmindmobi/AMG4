"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/supabase/config";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await signup(
        String(fd.get("email")),
        String(fd.get("password")),
        String(fd.get("full_name")),
      );
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Create account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Track orders nationwide, wherever you are in Kenya.
      </p>
      <div className="mt-8 space-y-4">
        <GoogleAuthButton label="Continue with Google" nextPath="/account" />
        {!isDemoMode() && (
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Full name
          <input
            name="full_name"
            required
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
          />
        </label>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ember py-3 text-[15px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-forest underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
