/**
 * Create/promote admin@amg.com in Supabase Auth + profiles.
 * Usage: node --env-file=.env.local scripts/ensure-admin-user.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = (process.env.ADMIN_EMAIL || "admin@amg.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "admin123";
const fullName = process.env.ADMIN_FULL_NAME || "AMG Admin";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log("Created auth user", email);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), full_name: fullName },
    });
    if (error) throw error;
    console.log("Updated auth user password", email);
  }

  // Prefer a minimal upsert — older projects may not have supplier_id/rider_id yet.
  let profileError = (
    await admin.from("profiles").upsert(
      { id: user.id, full_name: fullName, role: "admin" },
      { onConflict: "id" },
    )
  ).error;

  if (profileError) {
    // Row may already exist from the auth trigger — try update only.
    profileError = (
      await admin
        .from("profiles")
        .update({ full_name: fullName, role: "admin" })
        .eq("id", user.id)
    ).error;
  }
  if (profileError) throw profileError;

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!profile || profile.role !== "admin") {
    throw new Error(
      "Profile was not promoted to admin. Run migrations, then: update public.profiles set role = 'admin' where id = '" +
        user.id +
        "';",
    );
  }

  console.log("Promoted profile role=admin for", email);
  console.log("OK — sign in with", email, "/", password);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
