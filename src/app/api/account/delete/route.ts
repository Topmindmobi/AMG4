import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Self-service account deletion (Play Store requires this for apps with
 * account creation). Deletes the auth user; profiles/push_subscriptions/
 * notifications cascade-delete via their FK constraints (see
 * supabase/migrations/001_schema.sql, 004_supplier_workflow.sql,
 * 010_push_subscriptions.sql). orders.user_id and quote_requests.user_id are
 * `on delete set null` by design — past orders are business/financial
 * records, not identity data, so they're detached rather than destroyed.
 */
export async function POST() {
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ error: "Account deletion is not configured" }, { status: 501 });
  }

  const server = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await server.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[account/delete]", deleteError);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  await server.auth.signOut();

  return NextResponse.json({ deleted: true });
}
