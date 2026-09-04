import "server-only";
import { Resend } from "resend";
import { shortOrderRef, type OrderSmsEvent } from "@/lib/sms/twilio";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BRAND_ORANGE = "#f0672e";

function ctaButtonHtml(url: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${url}" style="display:inline-block;background:${BRAND_ORANGE};color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(label)}</a></p>`;
}

/** Same footer on every outgoing email — head office address + site link. */
function footerHtml(): string {
  return `
<hr style="margin:28px 0 16px;border:none;border-top:1px solid #e5e5e5;" />
<p style="font-size:12.5px;line-height:1.7;color:#767676;">
  <strong style="color:#3a3a3a;">AMG STORES</strong><br />
  Head Office:<br />
  Lower Hill Office Duplex, Lower Hill Road, Nairobi Kenya.<br />
  <a href="https://www.amgstores.ai" style="color:#767676;">www.amgstores.ai</a>
</p>`;
}

/** Wraps a greeting + body + optional CTA button + the standard footer. Every send function below goes through this so the letterhead stays consistent. */
function renderEmail(input: {
  name: string;
  bodyHtml: string;
  cta?: { url: string; label: string };
}): string {
  const greetName = input.name.trim() || "there";
  return `<p>Hi ${escapeHtml(greetName)},</p>
${input.bodyHtml}
${input.cta ? ctaButtonHtml(input.cta.url, input.cta.label) : ""}
${footerHtml()}`;
}

function buildSubjectAndBody(input: {
  event: OrderSmsEvent;
  orderId: string;
  name: string;
  orderUrl: string;
}): { subject: string; html: string } {
  const ref = shortOrderRef(input.orderId);
  const copy: Record<OrderSmsEvent, { subject: string; line: string; ctaLabel: string; ctaUrl: string }> = {
    placed: {
      subject: `We received your AMG Online Store order ${ref}`,
      line: "We'll confirm it shortly.",
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    confirmed: {
      subject: `Your AMG Online Store order ${ref} is confirmed`,
      line: "We'll dispatch it soon.",
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    dispatched: {
      subject: `Your AMG Online Store order ${ref} is out for delivery`,
      line: "Our rider is on the way.",
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    delivered: {
      subject: `Your AMG Online Store order ${ref} has been delivered`,
      line: "Asante for shopping with AMG Online Store!",
      ctaLabel: "View your order",
      ctaUrl: input.orderUrl,
    },
    cancelled: {
      subject: `Your AMG Online Store order ${ref} was cancelled`,
      line: "If this wasn't expected, please contact us.",
      ctaLabel: "View your order",
      ctaUrl: input.orderUrl,
    },
    review_reminder: {
      subject: `How was your AMG Online Store order ${ref}?`,
      line: "We'd love a quick rating — it only takes a moment.",
      ctaLabel: "Leave a review",
      ctaUrl: `${input.orderUrl}#rate-your-order`,
    },
  };
  const { subject, line, ctaLabel, ctaUrl } = copy[input.event];
  return {
    subject,
    html: renderEmail({
      name: input.name,
      bodyHtml: `<p>Order <strong>${ref}</strong>: ${line}</p>`,
      cta: { url: ctaUrl, label: ctaLabel },
    }),
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
  name?: string | null;
  siteUrl: string;
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
    const { subject, html } = buildSubjectAndBody({
      event: input.event,
      orderId: input.orderId,
      name: input.name ?? "",
      orderUrl: `${input.siteUrl}/order/${input.orderId}`,
    });
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
  siteUrl: string;
}): Promise<SendOrderEmailResult> {
  if (!isEmailConfigured()) {
    const reason = "Email not configured (RESEND_API_KEY / EMAIL_FROM)";
    console.warn(`[email] skipped welcome: ${reason}`);
    return { sent: false, skipped: true, reason };
  }
  if (!input.to || !input.to.includes("@")) {
    return { sent: false, skipped: true, reason: `Invalid email: ${input.to}` };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(),
      to: input.to,
      subject: "Your AMG Online Store account",
      html: renderEmail({
        name: input.fullName ?? "",
        bodyHtml: `<p>We created an AMG Online Store account for you so you can track orders and reorder easily.</p>
<p>Sign in with:</p>
<ul>
  <li>Email: <strong>${escapeHtml(input.to)}</strong></li>
  <li>Temporary password: <strong>${escapeHtml(input.temporaryPassword)}</strong></li>
</ul>
<p>You can change your password after signing in. If you already had an account, you can ignore this message and sign in as usual.</p>`,
        cta: { url: `${input.siteUrl}/auth/login`, label: "Sign in to your account" },
      }),
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

/** Send the supplier/rider application decision email. Soft-fail, same as every other send here. */
export async function sendRoleApplicationDecisionEmail(input: {
  to: string;
  type: "supplier" | "rider";
  decision: "approved" | "rejected";
  reason?: string | null;
  name?: string | null;
  siteUrl: string;
}): Promise<SendOrderEmailResult> {
  if (!isEmailConfigured()) {
    const reason = "Email not configured (RESEND_API_KEY / EMAIL_FROM)";
    console.warn(`[email] skipped application decision: ${reason}`);
    return { sent: false, skipped: true, reason };
  }
  if (!input.to || !input.to.includes("@")) {
    return { sent: false, skipped: true, reason: `Invalid email: ${input.to}` };
  }

  const roleLabel = input.type === "supplier" ? "supplier" : "rider";
  const subject =
    input.decision === "approved"
      ? `Your AMG Online Store ${roleLabel} application was approved`
      : `Your AMG Online Store ${roleLabel} application update`;
  const bodyHtml =
    input.decision === "approved"
      ? `<p>Good news — your ${roleLabel} application has been approved.</p>`
      : `<p>Your ${roleLabel} application wasn't approved this time.</p>${
          input.reason ? `<p>Reason: ${escapeHtml(input.reason)}</p>` : ""
        }<p>You're welcome to apply again from your account page.</p>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(),
      to: input.to,
      subject,
      html: renderEmail({
        name: input.name ?? "",
        bodyHtml,
        cta: { url: `${input.siteUrl}/auth/login`, label: "Sign in to your account" },
      }),
    });
    if (error) throw error;
    console.info(`[email] application ${input.decision} sent -> ${input.to} id=${data?.id}`);
    return { sent: true, id: data?.id ?? "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] application decision failed:`, error);
    return { sent: false, skipped: false, error };
  }
}
