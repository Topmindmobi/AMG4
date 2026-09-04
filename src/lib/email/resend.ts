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
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function ctaButtonHtml(url: string, label: string): string {
  return `<p style="margin:22px 0;"><a href="${url}" style="display:inline-block;background:${BRAND_ORANGE};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(label)}</a></p>`;
}

/** Logo, centered, linking back to the homepage — the brand header every email starts with. */
function logoHeaderHtml(siteUrl: string): string {
  return `
<div style="text-align:center;padding:8px 0 20px;">
  <a href="${siteUrl}"><img src="${siteUrl}/email/amg-logo.png" alt="AMG Stores" width="150" style="display:inline-block;height:auto;border:0;" /></a>
</div>`;
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

/**
 * Wraps every send in the same shell: logo header, greeting, body, optional
 * CTA button, then the standard footer — so the letterhead and structure
 * stay identical across every email this module sends.
 */
function renderEmail(input: {
  siteUrl: string;
  name: string;
  bodyHtml: string;
  cta?: { url: string; label: string };
}): string {
  const greetName = input.name.trim() || "there";
  return `<div style="max-width:560px;margin:0 auto;font-family:${FONT_STACK};color:#232323;font-size:15px;line-height:1.6;">
${logoHeaderHtml(input.siteUrl)}
<p>Hi ${escapeHtml(greetName)},</p>
${input.bodyHtml}
${input.cta ? ctaButtonHtml(input.cta.url, input.cta.label) : ""}
${footerHtml()}
</div>`;
}

/**
 * Every event's copy follows the same shape the user asked for: thank the
 * customer, tell them what just happened, then tell them what happens next.
 */
function buildSubjectAndBody(input: {
  event: OrderSmsEvent;
  orderId: string;
  name: string;
  orderUrl: string;
  contactUrl: string;
  siteUrl: string;
}): { subject: string; html: string } {
  const ref = shortOrderRef(input.orderId);
  const copy: Record<
    OrderSmsEvent,
    { subject: string; bodyHtml: string; ctaLabel: string; ctaUrl: string }
  > = {
    placed: {
      subject: `We received your AMG Online Store order ${ref}`,
      bodyHtml: `<p>Thank you for shopping with AMG Online Store! We've received your order <strong>${ref}</strong> and our team is reviewing it now.</p><p><strong>What's next:</strong> we'll confirm your order shortly, get it ready, and keep you updated by email at every step until it's delivered.</p>`,
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    confirmed: {
      subject: `Your AMG Online Store order ${ref} is confirmed`,
      bodyHtml: `<p>Good news — your order <strong>${ref}</strong> has been confirmed!</p><p><strong>What's next:</strong> we're preparing it for dispatch. As soon as it's handed to our rider, we'll email you again.</p>`,
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    dispatched: {
      subject: `Your AMG Online Store order ${ref} is out for delivery`,
      bodyHtml: `<p>Your order <strong>${ref}</strong> is on its way!</p><p><strong>What's next:</strong> our rider is heading to your delivery address now — please keep your phone nearby in case they need to reach you.</p>`,
      ctaLabel: "Track your order",
      ctaUrl: input.orderUrl,
    },
    delivered: {
      subject: `Your AMG Online Store order ${ref} has been delivered`,
      bodyHtml: `<p>Thank you for shopping with AMG Online Store! Your order <strong>${ref}</strong> has been delivered — asante for choosing us.</p><p><strong>What's next:</strong> we hope everything arrived in great condition. If you have a moment, we'd love to hear how it went.</p>`,
      ctaLabel: "Rate your order",
      ctaUrl: `${input.orderUrl}#rate-your-order`,
    },
    cancelled: {
      subject: `Your AMG Online Store order ${ref} was cancelled`,
      bodyHtml: `<p>Your order <strong>${ref}</strong> has been cancelled.</p><p><strong>What's next:</strong> if this wasn't expected or you have questions, please get in touch — we're happy to help. If you'd still like these items, you're welcome to place a new order any time.</p>`,
      ctaLabel: "Contact us",
      ctaUrl: input.contactUrl,
    },
    review_reminder: {
      subject: `How was your AMG Online Store order ${ref}?`,
      bodyHtml: `<p>Thank you again for shopping with AMG Online Store!</p><p>We hope you're enjoying your order <strong>${ref}</strong>. Your feedback helps us improve and helps other shoppers make great choices — it only takes a minute.</p>`,
      ctaLabel: "Leave a review",
      ctaUrl: `${input.orderUrl}#rate-your-order`,
    },
  };
  const { subject, bodyHtml, ctaLabel, ctaUrl } = copy[input.event];
  return {
    subject,
    html: renderEmail({
      siteUrl: input.siteUrl,
      name: input.name,
      bodyHtml,
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
      contactUrl: `${input.siteUrl}/contact`,
      siteUrl: input.siteUrl,
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
        siteUrl: input.siteUrl,
        name: input.fullName ?? "",
        bodyHtml: `<p>Thank you for shopping with AMG Online Store!</p>
<p>To make it easy to track this order and shop with us again, we've created an account for you.</p>
<p><strong>What's next:</strong> sign in any time using the details below, and feel free to change your password once you're in.</p>
<ul>
  <li>Email: <strong>${escapeHtml(input.to)}</strong></li>
  <li>Temporary password: <strong>${escapeHtml(input.temporaryPassword)}</strong></li>
</ul>
<p>If you already had an account, you can ignore this message and sign in as usual.</p>`,
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
  const dashboardPath = input.type === "supplier" ? "/supplier" : "/rider";
  const reapplyPath = input.type === "supplier" ? "/account/become-supplier" : "/account/become-rider";
  const subject =
    input.decision === "approved"
      ? `Your AMG Online Store ${roleLabel} application was approved`
      : `Your AMG Online Store ${roleLabel} application update`;
  const bodyHtml =
    input.decision === "approved"
      ? `<p>Thank you for applying to become an AMG Online Store ${roleLabel}!</p><p>We're excited to let you know your application has been approved.</p><p><strong>What's next:</strong> sign in to your account to access your ${roleLabel} dashboard and get started.</p>`
      : `<p>Thank you for your interest in becoming an AMG Online Store ${roleLabel}.</p><p>After review, we're unable to approve your application at this time.${
          input.reason ? ` Reason: ${escapeHtml(input.reason)}.` : ""
        }</p><p><strong>What's next:</strong> you're welcome to apply again whenever you're ready.</p>`;
  const cta =
    input.decision === "approved"
      ? { url: `${input.siteUrl}${dashboardPath}`, label: `Go to your ${roleLabel} dashboard` }
      : { url: `${input.siteUrl}${reapplyPath}`, label: "Apply again" };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(),
      to: input.to,
      subject,
      html: renderEmail({
        siteUrl: input.siteUrl,
        name: input.name ?? "",
        bodyHtml,
        cta,
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
