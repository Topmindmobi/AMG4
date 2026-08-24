"use client";

import { useEffect, useState } from "react";
import { flushQueuedOrders, listQueuedOrders } from "@/lib/offline/order-queue";

/**
 * Mounted once in the root layout. Registers the service worker app-wide
 * (previously only riders got it, via the push-subscription flow — see
 * src/lib/push/subscribe-client.ts), and drives the offline order queue:
 * flushes on reconnect / app foreground / a Background-Sync wake-up message,
 * and shows a small status pill so shoppers know an order is queued.
 */
export function PwaManager() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOffline(!navigator.onLine);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app still works online without offline caching.
      });
    }

    void refreshPending();

    function onOnline() {
      setOffline(false);
      void runFlush();
    }
    function onOffline() {
      setOffline(true);
    }
    function onVisibility() {
      if (document.visibilityState === "visible" && navigator.onLine) void runFlush();
    }
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "FLUSH_ORDER_QUEUE") void runFlush();
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onMessage);

    if (navigator.onLine) void runFlush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  async function refreshPending() {
    setPending((await listQueuedOrders()).length);
  }

  async function runFlush() {
    await flushQueuedOrders();
    await refreshPending();
  }

  if (!offline && pending === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="flex items-center gap-2 rounded-full bg-charcoal px-4 py-2 text-xs font-semibold text-white shadow-lg">
        {offline ? (
          <span>You&apos;re offline — browsing saved data</span>
        ) : (
          <span>Back online — syncing…</span>
        )}
        {pending > 0 && (
          <span className="rounded-full bg-ember px-2 py-0.5">
            {pending} order{pending === 1 ? "" : "s"} pending sync
          </span>
        )}
      </div>
    </div>
  );
}
