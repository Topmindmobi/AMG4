import { NextResponse } from "next/server";
import { sendOrderStatusEmail } from "@/lib/email/resend";
import { getRequestOrigin } from "@/lib/request-origin";
import { sendOrderStatusSms } from "@/lib/sms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Called by Supabase pg_cron (034_review_reminders.sql) roughly hourly — not
 * user-facing, so it's guarded by a shared secret instead of requireSession()
 * (there's no logged-in user in a cron context). Sends up to 2 "leave a
 * review" nudges per delivered, unrated order, every 3 days, then stops
 * regardless of whether the buyer ever rates it — see get_pending_review_reminders.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_pending_review_reminders", { p_limit: 200 });
  if (error) {
    console.error("[cron/review-reminders] failed to fetch candidates:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const orders = (data as Order[]) ?? [];
  const results: { orderId: string; smsSent: boolean; emailSent: boolean }[] = [];
  const siteUrl = getRequestOrigin(request);

  for (const order of orders) {
    const [smsResult, emailResult] = await Promise.all([
      order.phone
        ? sendOrderStatusSms({ orderId: order.id, phone: order.phone, event: "review_reminder" })
        : Promise.resolve(null),
      order.email
        ? sendOrderStatusEmail({
            orderId: order.id,
            to: order.email,
            event: "review_reminder",
            name: order.customer_name,
            siteUrl,
          })
        : Promise.resolve(null),
    ]);

    // Count the attempt regardless of per-channel delivery success — Twilio is
    // currently broken (soft-fails every time), and we don't want that to keep
    // an order retrying hourly forever instead of respecting the 2-attempt cap.
    const { error: markError } = await admin.rpc("mark_review_reminder_sent", {
      p_order_id: order.id,
    });
    if (markError) {
      console.error(`[cron/review-reminders] failed to mark order ${order.id}:`, markError.message);
    }

    results.push({
      orderId: order.id,
      smsSent: smsResult?.sent === true,
      emailSent: emailResult?.sent === true,
    });
  }

  return NextResponse.json({ ok: true, processed: orders.length, results });
}
