/**
 * Create all demo Auth users + profiles in Supabase (production).
 * Usage (PowerShell): load .env.local into env, then:
 *   node scripts/ensure-demo-users.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPPLIERS = [
  {
    id: "22222222-2222-2222-2222-222222222001",
    name: "Lakeview Electronics",
    contact_phone: "0722001100",
    town: "Homabay",
    notes: "Laptops, phones, printers",
  },
  {
    id: "22222222-2222-2222-2222-222222222002",
    name: "Ruma Fresh Farms",
    contact_phone: "0722002200",
    town: "Mbita",
    notes: "Eggs, fish, produce",
  },
  {
    id: "22222222-2222-2222-2222-222222222003",
    name: "Migori Hardware Hub",
    contact_phone: "0722003300",
    town: "Migori",
    notes: "Cement, iron sheets, paints",
  },
];

const RIDERS = [
  {
    id: "33333333-3333-3333-3333-333333333001",
    name: "Brian Otieno",
    phone: "0733001100",
    town: "Homabay",
  },
  {
    id: "33333333-3333-3333-3333-333333333002",
    name: "Faith Anyango",
    phone: "0733002200",
    town: "Mbita",
  },
  {
    id: "33333333-3333-3333-3333-333333333003",
    name: "Kevin Omondi",
    phone: "0733003300",
    town: "Migori",
  },
];

const USERS = [
  {
    email: "admin@amg.com",
    password: "admin123",
    full_name: "AMG Admin",
    role: "admin",
    town: "Homabay",
    phone: "0700000000",
  },
  {
    email: "customer@amg.com",
    password: "customer123",
    full_name: "Achieng Otieno",
    role: "customer",
    town: "Mbita",
    phone: "0712345678",
  },
  {
    email: "lakeview@amg.com",
    password: "supplier123",
    full_name: "Lakeview Electronics",
    role: "supplier",
    town: "Homabay",
    phone: "0722001100",
    supplier_id: "22222222-2222-2222-2222-222222222001",
  },
  {
    email: "ruma@amg.com",
    password: "supplier123",
    full_name: "Ruma Fresh Farms",
    role: "supplier",
    town: "Mbita",
    phone: "0722002200",
    supplier_id: "22222222-2222-2222-2222-222222222002",
  },
  {
    email: "migori@amg.com",
    password: "supplier123",
    full_name: "Migori Hardware Hub",
    role: "supplier",
    town: "Migori",
    phone: "0722003300",
    supplier_id: "22222222-2222-2222-2222-222222222003",
  },
  {
    email: "brian@amg.com",
    password: "rider123",
    full_name: "Brian Otieno",
    role: "rider",
    town: "Homabay",
    phone: "0733001100",
    rider_id: "33333333-3333-3333-3333-333333333001",
  },
  {
    email: "faith@amg.com",
    password: "rider123",
    full_name: "Faith Anyango",
    role: "rider",
    town: "Mbita",
    phone: "0733002200",
    rider_id: "33333333-3333-3333-3333-333333333002",
  },
  {
    email: "kevin@amg.com",
    password: "rider123",
    full_name: "Kevin Omondi",
    role: "rider",
    town: "Migori",
    phone: "0733003300",
    rider_id: "33333333-3333-3333-3333-333333333003",
  },
];

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

async function ensureAuthUser(entry) {
  const email = entry.email.toLowerCase();
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: entry.password,
      email_confirm: true,
      user_metadata: { full_name: entry.full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  auth: created ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: entry.password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), full_name: entry.full_name },
    });
    if (error) throw error;
    console.log(`  auth: updated ${email}`);
  }
  return user;
}

async function upsertProfile(userId, entry) {
  const base = {
    id: userId,
    full_name: entry.full_name,
    role: entry.role,
    phone: entry.phone ?? null,
    town: entry.town ?? null,
  };
  const withLinks = {
    ...base,
    supplier_id: entry.supplier_id ?? null,
    rider_id: entry.rider_id ?? null,
  };

  // Try full row (needs migrations 004 + 007). Fall back step by step.
  const attempts = [withLinks, base, { id: userId, full_name: entry.full_name, role: entry.role }];

  let lastError = null;
  for (const row of attempts) {
    let { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
    if (error) {
      ({ error } = await admin.from("profiles").update(row).eq("id", userId));
    }
    if (!error) {
      if (row !== withLinks && (entry.supplier_id || entry.rider_id)) {
        console.log(
          `  profile: ${entry.email} role=${entry.role} (link columns missing — run migrations 004/007)`,
        );
      } else {
        console.log(`  profile: ${entry.email} role=${entry.role}`);
      }
      return;
    }
    lastError = error;
  }
  throw lastError;
}

async function ensureReferenceData() {
  const { error: sErr } = await admin.from("suppliers").upsert(SUPPLIERS, {
    onConflict: "id",
  });
  if (sErr) {
    console.warn("  suppliers upsert:", sErr.message);
  } else {
    console.log("  suppliers: ok");
  }

  const { error: rErr } = await admin.from("riders").upsert(RIDERS, {
    onConflict: "id",
  });
  if (rErr) {
    console.warn("  riders upsert:", rErr.message, "(run migration 007 + seed if needed)");
  } else {
    console.log("  riders: ok");
  }
}

async function main() {
  console.log("Ensuring reference suppliers/riders…");
  await ensureReferenceData();

  console.log("Ensuring demo users…");
  const results = [];
  for (const entry of USERS) {
    try {
      const user = await ensureAuthUser(entry);
      await upsertProfile(user.id, entry);
      results.push({ email: entry.email, password: entry.password, role: entry.role, ok: true });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : JSON.stringify(err);
      console.error(`  FAIL ${entry.email}:`, message);
      results.push({ email: entry.email, password: entry.password, role: entry.role, ok: false, message });
    }
  }

  console.log("\nLogin credentials:");
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.email} / ${r.password} (${r.role})`);
  }

  if (results.some((r) => !r.ok)) process.exit(1);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
