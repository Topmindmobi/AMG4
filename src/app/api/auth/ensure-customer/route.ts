import { NextResponse } from "next/server";
import type {
  EnsureCustomerAccountInput,
  EnsureCustomerAccountResult,
} from "@/lib/auth/ensure-customer-account";
import { generateTemporaryPassword } from "@/lib/auth/password";
import { sendAccountWelcomeEmail } from "@/lib/email/resend";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Soft-fail account ensure for guest checkout.
 * Creates a Supabase Auth user when the email is new; returns existing user id otherwise.
 * Never blocks order placement — always HTTP 200 with result details.
 */
export async function POST(request: Request) {
  let body: EnsureCustomerAccountInput;
  try {
    body = (await request.json()) as EnsureCustomerAccountInput;
  } catch {
    return NextResponse.json(
      {
        userId: null,
        created: false,
        existed: false,
        email: "",
        error: "Invalid JSON body",
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      {
        userId: null,
        created: false,
        existed: false,
        email,
        error: "Valid email required",
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  }

  if (isDemoMode()) {
    return NextResponse.json(
      {
        userId: null,
        created: false,
        existed: false,
        email,
        error: "Demo mode uses client-side ensureDemoCustomerAccount",
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  }

  if (!isAdminClientConfigured()) {
    return NextResponse.json(
      {
        userId: null,
        created: false,
        existed: false,
        email,
        error: "SUPABASE_SERVICE_ROLE_KEY not configured",
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  }

  try {
    const admin = createAdminClient();
    const fullName = body.fullName?.trim() || email.split("@")[0] || "Customer";

    const existing = await findUserIdByEmail(admin, email);
    if (existing) {
      await softUpdateProfile(admin, existing, {
        fullName,
        phone: body.phone,
        town: body.town,
      });
      return NextResponse.json(
        {
          userId: existing,
          created: false,
          existed: true,
          email,
        } satisfies EnsureCustomerAccountResult,
        { status: 200 },
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      // Race: another request created the user
      const raced = await findUserIdByEmail(admin, email);
      if (raced) {
        return NextResponse.json(
          {
            userId: raced,
            created: false,
            existed: true,
            email,
          } satisfies EnsureCustomerAccountResult,
          { status: 200 },
        );
      }
      throw error;
    }

    const userId = data.user?.id ?? null;
    if (userId) {
      await softUpdateProfile(admin, userId, {
        fullName,
        phone: body.phone,
        town: body.town,
      });
    }

    const mail = await sendAccountWelcomeEmail({
      to: email,
      temporaryPassword,
      fullName,
    });
    if (!mail.sent) {
      console.info(
        `[ensure-customer] welcome email not sent (${"skipped" in mail && mail.skipped ? mail.reason : "error" in mail ? mail.error : "unknown"}); password returned to client once`,
      );
    }

    return NextResponse.json(
      {
        userId,
        created: true,
        existed: false,
        email,
        // Shown once on order confirmation; also emailed when Resend is configured.
        temporaryPassword,
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ensure-customer]", error);
    return NextResponse.json(
      {
        userId: null,
        created: false,
        existed: false,
        email,
        error,
      } satisfies EnsureCustomerAccountResult,
      { status: 200 },
    );
  }
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  // Prefer listUsers filter when available; paginate as a fallback for small user bases.
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function softUpdateProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  fields: { fullName: string; phone?: string | null; town?: string | null },
) {
  try {
    const patch: Record<string, string | null> = { full_name: fields.fullName };
    if (fields.phone) patch.phone = fields.phone.trim();
    if (fields.town) patch.town = fields.town;
    await admin.from("profiles").update(patch).eq("id", userId);
  } catch (err) {
    console.warn("[ensure-customer] profile update soft-failed", err);
  }
}
