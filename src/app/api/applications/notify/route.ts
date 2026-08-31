import { NextResponse } from "next/server";
import { sendRoleApplicationDecisionEmail } from "@/lib/email/resend";
import { requireAdminSession } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

type Body = {
  to?: string;
  type?: string;
  decision?: string;
  reason?: string | null;
};

/**
 * Soft-fail email notify for a supplier/rider application decision.
 * Admin-only (requireAdminSession) — this is called right after
 * approve_role_application()/reject_role_application() succeed from the
 * admin applications queue, mirroring src/app/api/orders/email/route.ts's
 * shape.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, sent: false, error: "Invalid JSON body" }, { status: 200 });
  }

  const to = body.to?.trim();
  const type = body.type?.trim();
  const decision = body.decision?.trim();

  if (!to || (type !== "supplier" && type !== "rider") || (decision !== "approved" && decision !== "rejected")) {
    return NextResponse.json(
      { ok: false, sent: false, error: "Required: to, type (supplier|rider), decision (approved|rejected)" },
      { status: 200 },
    );
  }

  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, sent: false, error: "Admin only" }, { status: 401 });
  }

  const result = await sendRoleApplicationDecisionEmail({
    to,
    type,
    decision,
    reason: body.reason ?? null,
  });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
