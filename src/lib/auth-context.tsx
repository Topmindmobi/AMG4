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
  supplierId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
  homePathForRole: () => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function roleHome(user: Profile | null): string {
  if (!user) return "/";
  if (user.role === "admin") return "/admin";
  if (user.role === "supplier") return "/supplier";
  return "/account";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isDemoMode()) {
      setSession(getDemoSession());
      setLoading(false);
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
            created_at: new Date().toISOString(),
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

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      email: session?.email ?? null,
      loading,
      isAdmin: session?.user.role === "admin",
      isSupplier: session?.user.role === "supplier",
      supplierId: session?.user.supplier_id ?? null,
      login,
      signup,
      signInWithGoogle,
      logout,
      refresh,
      homePathForRole: () => roleHome(session?.user ?? null),
    }),
    [session, loading, login, signup, signInWithGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
