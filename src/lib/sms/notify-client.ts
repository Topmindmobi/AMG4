/** Client helper: request order SMS. Never throws; never blocks callers. */
export async function notifyOrderSms(input: {
  orderId: string;
  phone: string;
  event: "confirmed" | "dispatched";
}): Promise<void> {
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
      console.warn(
        "[sms] not sent:",
        data.error ?? data.reason ?? "unknown",
        data.code != null ? `(code=${data.code})` : "",
      );
      return;
    }
    console.info("[sms] notify ok", data.to, data.sid ?? "");
  } catch (err) {
    console.error("[sms] notify failed:", err);
  }
}
