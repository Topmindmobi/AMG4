export type SubscribeResult = { subscribed: boolean; reason?: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Registers the service worker, requests Notification permission, and stores the subscription. */
export async function ensurePushSubscription(userId: string): Promise<SubscribeResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { subscribed: false, reason: "Push isn't supported in this browser" };
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { subscribed: false, reason: "Push isn't configured for this deployment" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { subscribed: false, reason: "Notification permission denied" };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, endpoint: subscription.endpoint, keys: json.keys }),
    });
    return { subscribed: true };
  } catch (err) {
    return { subscribed: false, reason: err instanceof Error ? err.message : "Subscription failed" };
  }
}

/** Fire-and-forget: tell the server to push a "payment sent" alert to this user's devices. */
export async function notifyRiderPayoutPush(input: {
  userId: string;
  orderId: string;
  amountKes: number;
}): Promise<void> {
  try {
    await fetch("/api/push/notify-payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    console.error("[push] notify-payout failed:", err);
  }
}

/** Push when an order is dispatched to a rider. */
export async function notifyRiderDispatchPush(input: {
  userId: string;
  orderId: string;
  town?: string;
  totalKes?: number;
  customerName?: string;
}): Promise<void> {
  try {
    await fetch("/api/push/notify-dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    console.error("[push] notify-dispatch failed:", err);
  }
}

/** Push when rider sends door-side M-Pesa STK — wait for payment before leaving. */
export async function notifyMpesaCollectPush(input: {
  riderUserId: string;
  customerUserId?: string | null;
  orderId: string;
  amountKes: number;
  phone?: string;
}): Promise<void> {
  try {
    await fetch("/api/push/notify-mpesa-collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    console.error("[push] notify-mpesa-collect failed:", err);
  }
}
