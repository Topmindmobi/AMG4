"use client";

import { useEffect, useState } from "react";
import { ImpendingTaskBanner } from "@/components/dashboard/ImpendingTaskBanner";
import { RiderDeliveryKanban } from "@/components/rider/RiderDeliveryKanban";
import { useAuth } from "@/lib/auth-context";
import { listNotifications } from "@/lib/data/notifications";
import { formatKes, RIDER_PAYOUT_KES } from "@/lib/format";
import { payNowWithMpesa } from "@/lib/mpesa/pay-now-client";
import { notifyOrderStatus } from "@/lib/notifications/notify-client";
import {
  ensurePushSubscription,
  notifyMpesaCollectPush,
  notifyRiderPayoutPush,
} from "@/lib/push/subscribe-client";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoRiderOrders,
  getDemoRiderPayouts,
  markDemoOrderPaid,
  normalizeRiderDeliveryStatus,
  notifyDemoDoorMpesaPrompt,
  setDemoRiderDeliveryStatus,
} from "@/lib/store/demo-store";
import type { AppNotification, Order, RiderDeliveryStatus, RiderPayout } from "@/lib/types";

export default function RiderDashboardPage() {
  const { user, riderId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  function load() {
    if (!riderId) return;
    if (isDemoMode()) {
      void Promise.resolve().then(() => {
        setOrders(getDemoRiderOrders(riderId));
        setPayouts(getDemoRiderPayouts(riderId));
      });
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: orderRows }, { data: payoutRows }] = await Promise.all([
        supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("rider_id", riderId)
          .order("created_at", { ascending: false }),
        supabase
          .from("rider_payouts")
          .select("*")
          .eq("rider_id", riderId)
          .order("created_at", { ascending: false }),
      ]);
      setOrders((orderRows as Order[]) ?? []);
      setPayouts((payoutRows as RiderPayout[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  useEffect(() => {
    if (!user) return;
    void ensurePushSubscription(user.id).then((result) => {
      if (result.subscribed) {
        setPushStatus("Push alerts on for new dispatches.");
      } else if (result.reason) {
        setPushStatus(result.reason);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void listNotifications(user.id).then(setNotifications);
  }, [user]);

  async function enablePush() {
    if (!user) return;
    setPushStatus("Requesting permission…");
    const result = await ensurePushSubscription(user.id);
    setPushStatus(
      result.subscribed
        ? "Push alerts enabled on this device."
        : (result.reason ?? "Could not enable alerts."),
    );
  }

  async function onAdvance(
    orderId: string,
    to: RiderDeliveryStatus,
    extras?: { failReason?: string },
  ) {
    // Captured before load() below can change the `orders` array reference.
    const order = orders.find((o) => o.id === orderId);
    setBusy(`move-${orderId}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        setDemoRiderDeliveryStatus(orderId, to, {
          failReason: extras?.failReason,
        });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("set_rider_delivery_status", {
          p_order_id: orderId,
          p_to: to,
          p_fail_reason: extras?.failReason ?? null,
        });
        if (error) throw error;
      }
      setMessage(
        to === "paid"
          ? "Trip closed as Paid — payout recorded."
          : to === "failed"
            ? "Marked as Fail Delivery."
            : `Moved to ${to.replace("_", " ")}.`,
      );
      load();

      if (to === "paid" && user) {
        const amountKes = isDemoMode()
          ? (getDemoRiderPayouts(riderId ?? undefined).find((p) => p.order_id === orderId)
              ?.amount_kes ?? RIDER_PAYOUT_KES)
          : RIDER_PAYOUT_KES;
        await notifyRiderPayoutPush({ userId: user.id, orderId, amountKes });
      }

      // Parity with admin/order-status.tsx's onDeliver(), which calls the
      // same RPC and then notifies the buyer — without this, a buyer only
      // got a delivered SMS/email when admin closed the order, never when
      // the rider did it themselves through this page (the normal path).
      if (to === "delivered" && order) {
        await notifyOrderStatus({
          orderId,
          phone: order.phone,
          email: order.email,
          event: "delivered",
        });
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update stage");
      throw err;
    } finally {
      setBusy(null);
    }
  }

  async function collectCash(order: Order) {
    setBusy(`cash-${order.id}`);
    setMessage(null);
    try {
      if (isDemoMode()) {
        markDemoOrderPaid(order.id, { method: "cod", note: "Cash collected by rider" });
        const stage = normalizeRiderDeliveryStatus(
          getDemoRiderOrders(riderId!).find((o) => o.id === order.id) ?? order,
        );
        if (stage === "delivered" || stage === "paid") {
          setDemoRiderDeliveryStatus(order.id, "paid");
        }
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("rider_mark_order_paid", {
          p_order_id: order.id,
          p_method: "cod",
        });
        if (error) throw error;
      }
      setMessage(`Cash ${formatKes(Number(order.total_kes))} registered.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not register cash");
    } finally {
      setBusy(null);
    }
  }

  async function collectMpesa(order: Order, phone: string) {
    setBusy(`mpesa-${order.id}`);
    setMessage(null);
    try {
      if (isDemoMode()) notifyDemoDoorMpesaPrompt(order.id, phone);
      if (user) {
        await notifyMpesaCollectPush({
          riderUserId: user.id,
          customerUserId: order.user_id,
          orderId: order.id,
          amountKes: Number(order.total_kes),
          phone,
        });
      }

      setMessage(`M-Pesa push sent to ${phone}. Waiting for client PIN…`);

      const result = await payNowWithMpesa({
        phone,
        amountKes: Number(order.total_kes),
        accountRef: order.id.slice(0, 12),
      });
      if (!result.paid) throw new Error(result.error || "M-Pesa not confirmed");

      if (isDemoMode()) {
        markDemoOrderPaid(order.id, {
          method: "mpesa",
          mpesa_phone: phone,
          note: result.simulated ? "Simulated door STK" : "Door STK confirmed",
        });
        const refreshed = getDemoRiderOrders(riderId!).find((o) => o.id === order.id);
        const stage = normalizeRiderDeliveryStatus(refreshed ?? order);
        if (stage === "delivered" || stage === "paid") {
          setDemoRiderDeliveryStatus(order.id, "paid");
        }
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("rider_mark_order_paid", {
          p_order_id: order.id,
          p_method: "mpesa",
          p_mpesa_phone: phone,
        });
        if (error) throw error;
      }

      setMessage(`M-Pesa confirmed on ${phone}. Move the card to Paid when ready.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "M-Pesa failed");
      throw err;
    } finally {
      setBusy(null);
    }
  }

  const assigned = orders.filter(
    (o) => normalizeRiderDeliveryStatus(o) === "assigned",
  ).length;
  const inTransit = orders.filter(
    (o) => normalizeRiderDeliveryStatus(o) === "in_transit",
  ).length;
  const awaitingPay = orders.filter(
    (o) =>
      !o.paid &&
      ["in_transit", "delivered"].includes(normalizeRiderDeliveryStatus(o)),
  ).length;
  const totalEarned = payouts.reduce((s, p) => s + Number(p.amount_kes), 0);
  const unreadNote = notifications.find((n) => !n.read) ?? null;
  const impendingTask =
    assigned > 0
      ? {
          title: `${assigned} new assignment${assigned === 1 ? "" : "s"} waiting for pickup`,
          href: "#kanban",
          linkLabel: "See below",
        }
      : unreadNote
        ? {
            title: unreadNote.title,
            description: unreadNote.body,
            href: unreadNote.link ?? "/rider",
            linkLabel: "View",
          }
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-sand">Delivery kanban</h1>
          <p className="mt-1 max-w-xl text-sm text-sand/55">
            Drag orders: My deliveries → Collected → In Transit → Delivered →
            Paid. Use Fail Delivery when you cannot complete the drop. Collect
            M-Pesa or cash before moving to Paid.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void enablePush()}
          className="border border-white/20 px-3 py-2 text-xs font-semibold text-sand/80 hover:text-sand"
        >
          Enable push alerts
        </button>
      </div>
      {pushStatus && <p className="mt-2 text-xs text-sand/50">{pushStatus}</p>}
      {message && (
        <p className="mt-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-sand">
          {message}
        </p>
      )}

      {impendingTask && (
        <div className="mt-4">
          <ImpendingTaskBanner {...impendingTask} dark />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="New assignments" value={String(assigned)} />
        <Stat label="In transit" value={String(inTransit)} />
        <Stat label="Awaiting payment" value={String(awaitingPay)} />
        <Stat label="Total earned" value={formatKes(totalEarned)} />
      </div>

      <div id="kanban" className="mt-8">
        <RiderDeliveryKanban
          orders={orders}
          busy={busy}
          onAdvance={onAdvance}
          onCollectCash={(o) => void collectCash(o)}
          onSendMpesa={(o, phone) => collectMpesa(o, phone)}
        />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-sand/60">
        Recent payouts
      </h2>
      <ul className="mt-3 divide-y divide-white/10 border-y border-white/10 text-sm">
        {payouts.slice(0, 10).map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2.5">
            <span className="text-sand/70">
              Order {p.order_id.slice(0, 10)} ·{" "}
              {new Date(p.created_at).toLocaleDateString()}
            </span>
            <span className="font-medium text-sand">
              {formatKes(p.amount_kes)}
            </span>
          </li>
        ))}
        {payouts.length === 0 && (
          <li className="py-3 text-sand/50">No payouts yet.</li>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-sand/45">{label}</p>
      <p className="mt-1 font-display text-xl text-sand">{value}</p>
    </div>
  );
}
