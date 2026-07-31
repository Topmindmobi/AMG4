import "server-only";
import twilio from "twilio";
export { normalizeKenyaPhone } from "@/lib/phone";
import { normalizeKenyaPhone } from "@/lib/phone";

export type OrderSmsEvent = "confirmed" | "dispatched" | "delivered";

export function isTwilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from =
    process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();
  return Boolean(sid && token && from);
}

export function shortOrderRef(orderId: string): string {
  if (orderId.startsWith("ord-")) {
    return orderId.slice(0, 12);
  }
  const hex = orderId.replace(/-/g, "");
  return hex.slice(0, 8).toUpperCase();
}

function buildMessage(event: OrderSmsEvent, orderId: string): string {
  const ref = shortOrderRef(orderId);
  if (event === "confirmed") {
    return `AMG Store: Your order ${ref} is confirmed. We will dispatch soon.`;
  }
  if (event === "delivered") {
    return `AMG Store: Your order ${ref} has been delivered. Asante for shopping with AMG!`;
  }
  return `AMG Store: Your order ${ref} is out for delivery (dispatched).`;
}

export type SendOrderSmsResult =
  | { sent: true; to: string; sid: string; status?: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string; code?: number | string };

function formatTwilioError(err: unknown): { error: string; code?: number | string } {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      code?: number | string;
      status?: number;
      moreInfo?: string;
    };
    const parts = [
      e.message,
      e.code != null ? `code=${e.code}` : null,
      e.status != null ? `http=${e.status}` : null,
      e.moreInfo ? `info=${e.moreInfo}` : null,
    ].filter(Boolean);
    if (parts.length) {
      return { error: parts.join(" | "), code: e.code };
    }
  }
  return { error: err instanceof Error ? err.message : String(err) };
}

/**
 * Send order status SMS via Twilio. Never throws — logs and returns soft failure.
 */
export async function sendOrderStatusSms(input: {
  phone: string;
  orderId: string;
  event: OrderSmsEvent;
}): Promise<SendOrderSmsResult> {
  if (!isTwilioConfigured()) {
    const reason = "Twilio env not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER)";
    console.warn(`[sms] skipped: ${reason}`);
    return { sent: false, skipped: true, reason };
  }

  const to = normalizeKenyaPhone(input.phone);
  if (!to) {
    const reason = `Invalid Kenya phone for SMS: ${input.phone}`;
    console.warn(`[sms] skipped: ${reason}`);
    return { sent: false, skipped: true, reason };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  const body = buildMessage(input.event, input.orderId);

  try {
    const client = twilio(accountSid, authToken);
    const payload = messagingServiceSid
      ? { to, body, messagingServiceSid }
      : { to, body, from: fromNumber! };

    const message = await client.messages.create(payload);
    console.info(
      `[sms] sent ${input.event} for order ${input.orderId} → ${to} sid=${message.sid} status=${message.status}`,
    );
    return { sent: true, to, sid: message.sid, status: message.status };
  } catch (err) {
    const { error, code } = formatTwilioError(err);
    const authHint =
      code === 20003 || /authenticate/i.test(error)
        ? " | Fix: paste a fresh TWILIO_AUTH_TOKEN from Twilio Console → Account → API keys & tokens (RUN_TIME on DO)."
        : code === 21608 || /unverified/i.test(error)
          ? " | Trial: verify the To number in Twilio Console → Phone Numbers → Verified Caller IDs."
          : "";
    const fullError = `${error}${authHint}`;
    console.error(`[sms] failed ${input.event} for order ${input.orderId}:`, fullError);
    return { sent: false, skipped: false, error: fullError, code };
  }
}
