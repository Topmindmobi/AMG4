import type { OrderSmsEvent } from "@/lib/sms/twilio";

export interface NotifyChannelResult {
  attempted: boolean;
  sent: boolean;
  to?: string;
}

export interface NotifyOrderStatusResult {
  sms: NotifyChannelResult;
  email: NotifyChannelResult;
}

/** Client helper: request order SMS. Never throws; never blocks callers. */
async function notifyOrderSms(input: { orderId: string; phone: string; event: OrderSmsEvent }): Promise<NotifyChannelResult> {
  try {
    const res = await fetch("/api/orders/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[sms] notify HTTP", res.status);
      return { attempted: true, sent: false, to: input.phone };
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
      return { attempted: true, sent: false, to: input.phone };
    }
    console.info("[sms] notify ok", data.to, data.sid ?? "");
    return { attempted: true, sent: true, to: data.to ?? input.phone };
  } catch (err) {
    console.error("[sms] notify failed:", err);
    return { attempted: true, sent: false, to: input.phone };
  }
}

/** Client helper: request order status email. Never throws; never blocks callers. */
async function notifyOrderEmail(input: { orderId: string; email: string; event: OrderSmsEvent }): Promise<NotifyChannelResult> {
  try {
    const res = await fetch("/api/orders/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[email] notify HTTP", res.status);
      return { attempted: true, sent: false, to: input.email };
    }
    const data = (await res.json()) as { sent?: boolean; error?: string; reason?: string };
    if (!data.sent) {
      console.warn("[email] not sent:", data.error ?? data.reason ?? "unknown");
      return { attempted: true, sent: false, to: input.email };
    }
    return { attempted: true, sent: true, to: input.email };
  } catch (err) {
    console.error("[email] notify failed:", err);
    return { attempted: true, sent: false, to: input.email };
  }
}

/**
 * Single entry point for "tell the buyer their order status changed" —
 * fires SMS (always, when a phone is on file) and email (when the buyer
 * gave one) in parallel, and returns the real per-channel outcome so
 * callers can show admin honest feedback instead of an assumed "notified"
 * message. In-app notifications are written separately by the demo-store /
 * Supabase RPC at the moment of the status change, since those don't need a
 * network round trip.
 */
export async function notifyOrderStatus(input: {
  orderId: string;
  phone?: string | null;
  email?: string | null;
  event: OrderSmsEvent;
}): Promise<NotifyOrderStatusResult> {
  const [sms, email] = await Promise.all([
    input.phone
      ? notifyOrderSms({ orderId: input.orderId, phone: input.phone, event: input.event })
      : Promise.resolve<NotifyChannelResult>({ attempted: false, sent: false }),
    input.email
      ? notifyOrderEmail({ orderId: input.orderId, email: input.email, event: input.event })
      : Promise.resolve<NotifyChannelResult>({ attempted: false, sent: false }),
  ]);
  return { sms, email };
}

/** "Order moved from X to Y." — same phrasing everywhere a status changes. */
export function describeStatusMove(fromLabel: string, toLabel: string): string {
  return `Order moved from "${fromLabel}" to "${toLabel}".`;
}

/** "email sent to jane@x.com, SMS failed to send" — real outcome, not an assumption. */
export function describeNotifyResult(result: NotifyOrderStatusResult): string {
  const parts: string[] = [];
  if (result.email.attempted) {
    parts.push(result.email.sent ? `email sent to ${result.email.to}` : "email failed to send");
  }
  if (result.sms.attempted) {
    parts.push(result.sms.sent ? `SMS sent to ${result.sms.to}` : "SMS failed to send");
  }
  return parts.join(", ");
}
