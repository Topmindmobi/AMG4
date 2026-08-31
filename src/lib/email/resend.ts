import "server-only";
import { Resend } from "resend";
import { shortOrderRef, type OrderSmsEvent } from "@/lib/sms/twilio";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function buildSubjectAndBody(event: OrderSmsEvent, orderId: string): { subject: string; html: string } {
  const ref = shortOrderRef(orderId);
  const body: Record<OrderSmsEvent, { subject: string; line: string }> = {
    placed: {
      subject: `We received your AMG Online Store order ${ref}`,
      line: "We'll confirm it shortly.",
    },
    confirmed: {
      subject: `Your AMG Online Store order ${ref} is confirmed`,
      line: "We'll dispatch it soon.",
    },
    dispatched: {
      subject: `Your AMG Online Store order ${ref} is out for delivery`,
      line: "Our rider is on the way.",
    },
    delivered: {
      subject: `Your AMG Online Store order ${ref} has been delivered`,
      line: "Asante for shopping with AMG Online Store!",
    },
    cancelled: {
      subject: `Your AMG Online Store order ${ref} was cancelled`,
      line: "If this wasn't expected, please contact us.",
    },
  };
  const { subject, line } = body[event];
  return {
    subject,
    html: `<p>Hi,</p><p>Order <strong>${ref}</strong>: ${line}</p><p>Track it any time at your AMG Online Store order page.</p>`,
  };
}

export type SendOrderEmailResult =
  | { sent: true; id: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

/** Send order status email via Resend. Never throws — logs and returns soft failure. */
export async function sendOrderStatusEmail(input: {
  to: string;
  orderId: string;
  event: OrderSmsEvent;
}): Promise<SendOrderEmailResult> {
  if (!isEmailConfigured()) {
    const reason = "Email not configured (RESEND_API_KEY / EMAIL_FROM)";
    console.warn(`[email] skipped: ${reason}`);
    return { sent: false, skipped: true, reason };
  }
  if (!input.to || !input.to.includes("@")) {
    const reason = `Invalid email address: ${input.to}`;
    console.warn(`[email] skipped: ${reason}`);
    return { sent: false, skipped: true, reason };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { subject, html } = buildSubjectAndBody(input.event, input.orderId);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(),
      to: input.to,
      subject,
      html,
    });
    if (error) throw error;
    console.info(`[email] sent ${input.event} for order ${input.orderId} -> ${input.to} id=${data?.id}`);
    return { sent: true, id: data?.id ?? "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] failed ${input.event} for order ${input.orderId}:`, error);
    return { sent: false, skipped: false, error };
  }
}

/** Send welcome email with temporary password after guest checkout account creation. Soft-fail. */
export async function sendAccountWelcomeEmail(input: {
  to: string;
  temporaryPassword: string;
  fullName?: string;
}): Promise<SendOrderEmailResult> {
  if (!isEmailConfigured()) {
    const reason = "Email not configured (RESEND_API_KEY / EMAIL_FROM)";
    console.warn(`[email] skipped welcome: ${reason}`);
    return { sent: false, skipped: true, reason };
  }
  if (!input.to || !input.to.includes("@")) {
    return { sent: false, skipped: true, reason: `Invalid email: ${input.to}` };
  }

  const name = input.fullName?.trim() || "there";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(),
      to: input.to,
      subject: "Your AMG Online Store account",
      html: `<p>Hi ${name},</p>
<p>We created an AMG Online Store account for you so you can track orders and reorder easily.</p>
<p>Sign in at your AMG Online Store site with:</p>
<ul>
  <li>Email: <strong>${input.to}</strong></li>
  <li>Temporary password: <strong>${input.temporaryPassword}</strong></li>
</ul>
<p>You can change your password after signing in. If you already had an account, you can ignore this message and sign in as usual.</p>`,
    });
    if (error) throw error;
    console.info(`[email] welcome sent -> ${input.to} id=${data?.id}`);
    return { sent: true, id: data?.id ?? "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] welcome failed:`, error);
    return { sent: false, skipped: false, error };
  }
}
