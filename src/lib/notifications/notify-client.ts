import type { OrderSmsEvent } from "@/lib/sms/twilio";

/** Client helper: request order SMS. Never throws; never blocks callers. */
async function notifyOrderSms(input: { orderId: string; phone: string; event: OrderSmsEvent }): Promise<void> {
  try {
    const res = await fetch("/api/orders/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[sms] notify HTTP", res.status);
      return;
    }
    const data = (await res.json()) as {
      sent?: boolean;
      error?: string;
      reason?: string;
      sid?: string;
      code?: number | string;
      to?: string;
    };
    if (!data.sent) {
      console.warn("[sms] not sent:", data.error ?? data.reason ?? "unknown", data.code != null ? `(code=${data.code})` : "");
      return;
    }
    console.info("[sms] notify ok", data.to, data.sid ?? "");
  } catch (err) {
    console.error("[sms] notify failed:", err);
  }
}

/** Client helper: request order status email. Never throws; never blocks callers. */
async function notifyOrderEmail(input: { orderId: string; email: string; event: OrderSmsEvent }): Promise<void> {
  try {
    const res = await fetch("/api/orders/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[email] notify HTTP", res.status);
      return;
    }
    const data = (await res.json()) as { sent?: boolean; error?: string; reason?: string };
    if (!data.sent) {
      console.warn("[email] not sent:", data.error ?? data.reason ?? "unknown");
    }
  } catch (err) {
    console.error("[email] notify failed:", err);
  }
}

/**
 * Single entry point for "tell the buyer their order status changed" —
 * fires SMS (always, when a phone is on file) and email (when the buyer
 * gave one) in parallel. In-app notifications are written separately by the
 * demo-store / Supabase RPC at the moment of the status change, since those
 * don't need a network round trip.
 */
export async function notifyOrderStatus(input: {
  orderId: string;
  phone?: string | null;
  email?: string | null;
  event: OrderSmsEvent;
}): Promise<void> {
  await Promise.all([
    input.phone ? notifyOrderSms({ orderId: input.orderId, phone: input.phone, event: input.event }) : null,
    input.email ? notifyOrderEmail({ orderId: input.orderId, email: input.email, event: input.event }) : null,
  ]);
}
