"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/supabase/config";

type GoogleAuthButtonProps = {
  label: string;
  nextPath?: string;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.7.5-2.4 1.9C5.1 19.2 8.3 21 12 21c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4z"
      />
      <path
        fill="#4A90E2"
        d="M3.5 7.3C2.9 8.5 2.5 9.7 2.5 11s.4 2.5 1 3.7c0 .1 3.1-2.4 3.1-2.4-.2-.5-.3-1.1-.3-1.6s.1-1.1.3-1.6L3.5 7.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.5c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3.5 14.7 2.5 12 2.5 8.3 2.5 5.1 4.3 3.5 7.3l3.1 2.4C7 8.4 9.2 6.5 12 6.5z"
      />
    </svg>
  );
}

export function GoogleAuthButton({ label, nextPath = "/account" }: GoogleAuthButtonProps) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isDemoMode()) {
    return null;
  }

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-forest bg-white py-3 text-[15px] font-semibold text-forest transition hover:bg-sand disabled:opacity-60"
      >
        <GoogleIcon className="h-5 w-5 shrink-0" />
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="text-sm text-ember">{error}</p>}
    </div>
  );
}
