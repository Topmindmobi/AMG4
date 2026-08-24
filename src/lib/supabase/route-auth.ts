import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

export type AuthedSession = {
  server: ServerClient;
  userId: string;
  email: string | null;
};

/**
 * Verifies the caller has a real, cookie-backed Supabase session — the same
 * pattern already used correctly in src/app/api/account/delete/route.ts.
 * Returns null (never throws) when there's no session or Supabase isn't
 * configured for this deployment (e.g. demo mode with no env vars set).
 */
export async function requireSession(): Promise<AuthedSession | null> {
  try {
    const server = await createServerClient();
    const {
      data: { user },
      error,
    } = await server.auth.getUser();
    if (error || !user) return null;
    return { server, userId: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

/** Verifies the caller is signed in AND holds the admin role in profiles. */
export async function requireAdminSession(): Promise<AuthedSession | null> {
  const session = await requireSession();
  if (!session) return null;
  const { data: profile } = await session.server
    .from("profiles")
    .select("role")
    .eq("id", session.userId)
    .maybeSingle();
  if (profile?.role !== "admin") return null;
  return session;
}
