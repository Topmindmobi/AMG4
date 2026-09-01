"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  demoDeleteAccount,
  demoLogin,
  demoLogout,
  demoSignup,
  getDemoSession,
  type DemoSession,
} from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";
import type { Profile } from "@/lib/types";

type AuthContextValue = {
  user: Profile | null;
  email: string | null;
  loading: boolean;
  isAdmin: boolean;
  isSupplier: boolean;
  isRider: boolean;
  supplierId: string | null;
  riderId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => void;
  homePathForRole: () => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function roleHomePath(user: Profile | null): string {
  if (!user) return "/";
  if (user.role === "admin") return "/admin";
  if (user.role === "supplier") return "/supplier";
  if (user.role === "rider") return "/rider";
  return "/account";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isDemoMode()) {
      void Promise.resolve().then(() => {
        setSession(getDemoSession());
        setLoading(false);
      });
      return;
    }
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          setSession(null);
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();
        setSession({
          user: (profile as Profile) ?? {
            id: data.user.id,
            full_name:
              data.user.user_metadata?.full_name ??
              data.user.user_metadata?.name ??
              null,
            phone: null,
            role: "customer",
            town: null,
            supplier_id: null,
            rider_id: null,
            created_at: new Date().toISOString(),
            address: null,
            city: null,
            country: null,
            lat: null,
            lng: null,
            maps_url: null,
            profile_prompt_shown_at: null,
          },
          email: data.user.email ?? "",
        });
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (isDemoMode()) {
        setSession(demoLogin(email, password));
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      refresh();
    },
    [refresh],
  );

  const signup = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (isDemoMode()) {
        setSession(demoSignup(email, password, fullName));
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      refresh();
    },
    [refresh],
  );

  const signInWithGoogle = useCallback(async (nextPath = "/account") => {
    if (isDemoMode()) {
      throw new Error("Google sign-in is unavailable in demo mode.");
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    const safeNext =
      nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
    redirectTo.searchParams.set("next", safeNext);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    if (isDemoMode()) {
      demoLogout();
      setSession(null);
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isDemoMode()) {
      demoDeleteAccount();
      setSession(null);
      return;
    }
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Could not delete account" }));
      throw new Error(body.error ?? "Could not delete account");
    }
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      email: session?.email ?? null,
      loading,
      isAdmin: session?.user.role === "admin",
      isSupplier: session?.user.role === "supplier",
      isRider: session?.user.role === "rider",
      supplierId: session?.user.supplier_id ?? null,
      riderId: session?.user.rider_id ?? null,
      login,
      signup,
      signInWithGoogle,
      logout,
      deleteAccount,
      refresh,
      homePathForRole: () => roleHomePath(session?.user ?? null),
    }),
    [session, loading, login, signup, signInWithGoogle, logout, deleteAccount, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
