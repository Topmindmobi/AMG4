import "server-only";
import { normalizeKenyaPhone } from "@/lib/sms/twilio";

/**
 * M-Pesa Daraja STK Push (Lipa na M-Pesa Online). Real integration, soft-fail
 * like the Twilio SMS module: when credentials aren't configured we never
 * throw — callers fall back to a simulated instant confirmation so checkout
 * always works in demo/dev environments.
 */

export function isDarajaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY?.trim() &&
      process.env.MPESA_CONSUMER_SECRET?.trim() &&
      process.env.MPESA_SHORTCODE?.trim() &&
      process.env.MPESA_PASSKEY?.trim(),
  );
}

function baseUrl(): string {
  return process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!.trim();
  const secret = process.env.MPESA_CONSUMER_SECRET!.trim();
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja OAuth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export type StkPushResult =
  | { initiated: true; checkoutRequestId: string; merchantRequestId: string }
  | { initiated: false; error: string };

/**
 * Initiate an STK push (pay-now prompt on the buyer's phone). When Daraja
 * isn't configured, returns a simulated result so the caller can proceed
 * with an instant "paid" confirmation — this is the path exercised in
 * demo/dev; the real branch requires live Daraja credentials + a publicly
 * reachable callback URL (see /api/mpesa/callback) to complete.
 */
export async function initiateStkPush(input: {
  phone: string;
  amountKes: number;
  accountRef: string;
  description: string;
}): Promise<StkPushResult> {
  if (!isDarajaConfigured()) {
    return {
      initiated: false,
      error: "Daraja env vars not configured (MPESA_CONSUMER_KEY / SECRET / SHORTCODE / PASSKEY)",
    };
  }

  const phone = normalizeKenyaPhone(input.phone);
  if (!phone) {
    return { initiated: false, error: `Invalid Kenya phone for M-Pesa: ${input.phone}` };
  }
  const mpesaPhone = phone.replace(/^\+/, "");

  try {
    const shortcode = process.env.MPESA_SHORTCODE!.trim();
    const passkey = process.env.MPESA_PASSKEY!.trim();
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
    const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();
    if (!callbackUrl) {
      return {
        initiated: false,
        error: "MPESA_CALLBACK_URL not set — Daraja requires a public HTTPS callback URL",
      };
    }

    const token = await getAccessToken();
    const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(input.amountKes)),
        PartyA: mpesaPhone,
        PartyB: shortcode,
        PhoneNumber: mpesaPhone,
        CallBackURL: callbackUrl,
        AccountReference: input.accountRef.slice(0, 12),
        TransactionDesc: input.description.slice(0, 13),
      }),
    });

    const data = (await res.json()) as {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      errorMessage?: string;
      ResponseDescription?: string;
    };

    if (!res.ok || !data.CheckoutRequestID) {
      return {
        initiated: false,
        error: data.errorMessage || data.ResponseDescription || `HTTP ${res.status}`,
      };
    }

    return {
      initiated: true,
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID ?? "",
    };
  } catch (err) {
    return {
      initiated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
