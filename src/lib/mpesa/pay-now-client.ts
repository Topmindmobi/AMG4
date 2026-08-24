export type PayNowResult =
  | { paid: true; simulated: boolean; message?: string; checkoutRequestId: string }
  | { paid: false; simulated: boolean; error: string };

/**
 * Drives the M-Pesa "pay now" step from the browser: initiates the STK
 * push, then (only in real/non-simulated mode) polls for the buyer's phone
 * confirmation. Never throws.
 */
export async function payNowWithMpesa(input: {
  phone: string;
  amountKes: number;
  accountRef: string;
}): Promise<PayNowResult> {
  try {
    const res = await fetch("/api/mpesa/stk-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as {
      ok: boolean;
      status?: "paid" | "pending" | "failed";
      simulated?: boolean;
      message?: string;
      checkoutRequestId?: string;
      error?: string;
    };

    if (!data.ok || data.status === "failed") {
      return { paid: false, simulated: Boolean(data.simulated), error: data.error || "Payment failed" };
    }

    if (data.status === "paid") {
      return {
        paid: true,
        simulated: Boolean(data.simulated),
        message: data.message,
        checkoutRequestId: data.checkoutRequestId ?? "",
      };
    }

    // Real STK push in flight — poll for the buyer's phone confirmation.
    if (data.checkoutRequestId) {
      const id = data.checkoutRequestId;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/mpesa/status?checkoutRequestId=${encodeURIComponent(id)}`);
        const pollData = (await poll.json()) as {
          ok: boolean;
          status?: string;
          reason?: string;
        };
        if (pollData.status === "paid") return { paid: true, simulated: false, checkoutRequestId: id };
        if (pollData.status === "failed") {
          return { paid: false, simulated: false, error: pollData.reason || "Payment declined" };
        }
      }
      return { paid: false, simulated: false, error: "Timed out waiting for M-Pesa confirmation" };
    }

    return { paid: false, simulated: false, error: "Unexpected response" };
  } catch (err) {
    return {
      paid: false,
      simulated: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
