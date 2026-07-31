"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { roleHomePath, useAuth } from "@/lib/auth-context";
import { getDemoSession } from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(() => {
    const authError = search.get("error");
    if (authError === "oauth") return "Google sign-in failed. Please try again.";
    if (authError === "auth_unavailable") return "Sign-in is temporarily unavailable.";
    return null;
  });
  const [loading, setLoading] = useState(false);
  const nextPath = search.get("next") || "/account";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await login(String(fd.get("email")), String(fd.get("password")));
      const forced = search.get("next");
      if (forced) {
        router.push(forced);
        return;
      }
      if (isDemoMode()) {
        router.push(roleHomePath(getDemoSession()?.user ?? null));
        return;
      }
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Customers, suppliers, riders, and AMG admin sign in here.
      </p>
      {isDemoMode() && (
        <div className="mt-4 space-y-1 rounded-lg border border-line bg-sand px-3 py-2.5 text-xs text-ink-soft">
          <p>
            Admin: <code>admin@amg.com</code> / <code>admin123</code>
          </p>
          <p>
            Customer: <code>customer@amg.com</code> / <code>customer123</code>
          </p>
          <p>
            Supplier: <code>lakeview@amg.com</code>, <code>ruma@amg.com</code>, or{" "}
            <code>migori@amg.com</code> / <code>supplier123</code>
          </p>
          <p>
            Rider: <code>brian@amg.com</code>, <code>faith@amg.com</code>, or{" "}
            <code>kevin@amg.com</code> / <code>rider123</code>
          </p>
        </div>
      )}
      <div className="mt-8 space-y-4">
        <GoogleAuthButton label="Sign in with Google" nextPath={nextPath} />
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
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
          />
        </label>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ember py-3 text-[15px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/auth/signup" className="font-semibold text-forest underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
