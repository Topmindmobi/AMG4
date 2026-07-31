"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RiderDeliveryTracker } from "@/components/orders/RiderDeliveryTracker";
import { useAuth } from "@/lib/auth-context";
import { DELIVERY_METHOD_LABELS, formatKes } from "@/lib/format";
import {
  readAccountCreatedNotice,
  readStashedOrderConfirmation,
  type AccountCreatedNotice,
} from "@/lib/order-confirmation";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoOrder } from "@/lib/store/demo-store";
import type { Order, OrderStatus } from "@/lib/types";

const TRACKING_STEPS: { statuses: OrderStatus[]; label: string }[] = [
  { statuses: ["pending", "awaiting_supplier", "supplier_confirmed"], label: "Order placed" },
  { statuses: ["confirmed"], label: "Confirmed" },
  { statuses: ["out_for_delivery"], label: "Out for delivery" },
  { statuses: ["delivered"], label: "Delivered" },
];

const POLL_MS = 5000;

function currentStepIndex(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  return TRACKING_STEPS.findIndex((step) => step.statuses.includes(status));
}

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountNotice, setAccountNotice] = useState<AccountCreatedNotice | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    setAccountNotice(readAccountCreatedNotice(id));

    async function fetchOrder(): Promise<Order | null> {
      if (isDemoMode()) return getDemoOrder(id);
      const stashed = readStashedOrderConfirmation(id);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_order_confirmation", {
          p_order_id: id,
        });
        if (!rpcError && rpcData) return rpcData as Order;
        const { data } = await supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("id", id)
          .maybeSingle();
        return (data as Order) ?? stashed;
      } catch {
        return stashed;
      }
    }

    let cancelled = false;
    void fetchOrder().then((o) => {
      if (!cancelled) {
        setOrder(o);
        setLoading(false);
      }
    });

    const poll = setInterval(() => {
      void fetchOrder().then((o) => !cancelled && o && setOrder(o));
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [params.id]);

  if (loading || authLoading) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading order…</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Order not found</h1>
        <Link href="/shop" className="mt-4 inline-block font-semibold text-forest underline">
          Back to shop
        </Link>
      </div>
    );
  }

  // Logged-in customers may only view their own orders; guests keep post-checkout link access.
  const isCustomer = user?.role === "customer";
  const forbidden =
    Boolean(user) &&
    !isAdmin &&
    isCustomer &&
    Boolean(order.user_id) &&
    order.user_id !== user!.id;

  if (forbidden) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">
          Order not available
        </h1>
        <p className="mt-3 text-ink-soft">
          You can only view your own orders. Open{" "}
          <Link href="/account/orders" className="font-semibold text-forest underline">
            My orders
          </Link>{" "}
          to see your deliveries.
        </p>
      </div>
    );
  }

  const stepIndex = currentStepIndex(order.status);

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Track your order</p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,36px)] text-charcoal">Asante!</h1>
      <p className="mt-3 text-ink-soft">
        {order.delivery_method === "dropoff" && order.dropoff_point_name
          ? `We'll notify you when it's ready at ${order.dropoff_point_name}.`
          : `We'll arrange motorcycle delivery to your doorstep in ${order.town}.`}
      </p>

      {accountNotice?.created && (
        <div className="mt-6 rounded-lg border border-forest/25 bg-forest/5 px-4 py-4 text-sm text-charcoal">
          <p className="font-semibold text-forest-deep">Your temporary login — save it now</p>
          <p className="mt-1 text-ink-soft">
            We created an account so you can monitor this order anytime. These details are shown
            once; keep them somewhere safe.
          </p>
          <dl className="mt-3 space-y-2 rounded-lg border border-line bg-white px-3 py-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Email</dt>
              <dd className="break-all font-medium">{accountNotice.email}</dd>
            </div>
            {accountNotice.temporaryPassword ? (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Temporary password
                </dt>
                <dd>
                  <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-xs text-forest-deep">
                    {accountNotice.temporaryPassword}
                  </code>
                </dd>
              </div>
            ) : (
              <p className="text-ink-soft">
                Check your email for a temporary password (or use password reset if needed).
              </p>
            )}
          </dl>
          <p className="mt-3 text-ink-soft">
            After signing in, open{" "}
            <Link href="/account/orders" className="font-semibold text-forest underline">
              My orders
            </Link>{" "}
            to track delivery status.
          </p>
          <Link
            href="/auth/login?next=/account/orders"
            className="mt-3 inline-flex rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-deep"
          >
            Sign in to monitor orders
          </Link>
        </div>
      )}
      {accountNotice && !accountNotice.created && (
        <div className="mt-6 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-charcoal">
          <p className="font-semibold">Account found</p>
          <p className="mt-1 text-ink-soft">
            An account already exists for{" "}
            <span className="font-medium text-charcoal">{accountNotice.email}</span>. Sign in to
            monitor this order under{" "}
            <Link href="/account/orders" className="font-semibold text-forest underline">
              My orders
            </Link>
            .
          </p>
          <Link
            href="/auth/login?next=/account/orders"
            className="mt-2 inline-block font-semibold text-forest underline"
          >
            Sign in
          </Link>
        </div>
      )}

      {order.status === "cancelled" ? (
        <p className="mt-8 rounded-lg border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember">
          This order was cancelled.
        </p>
      ) : (
        <ol className="mt-8 grid grid-cols-4 gap-1">
          {TRACKING_STEPS.map((step, i) => {
            const done = i <= stepIndex;
            return (
              <li key={step.label} className="flex flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <div
                    className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done ? "bg-forest" : "bg-line"}`}
                  />
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-forest text-white" : "bg-line text-ink-soft"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <div
                    className={`h-0.5 flex-1 ${i === TRACKING_STEPS.length - 1 ? "opacity-0" : i < stepIndex ? "bg-forest" : "bg-line"}`}
                  />
                </div>
                <p className={`mt-2 text-[11px] font-semibold ${done ? "text-forest-deep" : "text-ink-soft"}`}>
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <RiderDeliveryTracker order={order} audience="customer" />

      {order.status === "delivered" && !order.rider_id && (
        <p className="mt-6 rounded-lg bg-forest/10 px-4 py-3 text-sm text-forest-deep">
          Delivered{order.delivered_at ? ` on ${new Date(order.delivered_at).toLocaleString()}` : ""}.
        </p>
      )}

      <dl className="mt-8 space-y-3 border-y border-line py-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Order</dt>
          <dd className="max-w-[60%] truncate font-mono text-xs">{order.id}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Delivery</dt>
          <dd>
            {DELIVERY_METHOD_LABELS[order.delivery_method]}
            {order.delivery_method === "dropoff" && order.dropoff_point_name
              ? ` (${order.dropoff_point_name})`
              : ""}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Payment</dt>
          <dd className="uppercase">
            {order.payment_method}
            {order.paid ? " · paid online" : ""}
          </dd>
        </div>
        {order.discount_kes > 0 && (
          <div className="flex justify-between text-forest">
            <dt>Pay-now discount</dt>
            <dd>−{formatKes(order.discount_kes)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">Total</dt>
          <dd className="font-bold text-ember">{formatKes(order.total_kes)}</dd>
        </div>
      </dl>

      {order.items && order.items.length > 0 && (
        <ul className="mt-6 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.name_snapshot} × {item.qty}
              </span>
              <span>{formatKes(item.price_kes * item.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/shop"
          className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white hover:bg-ember-deep"
        >
          Keep shopping
        </Link>
        <Link href="/account/orders" className="text-sm font-semibold text-forest underline">
          My orders
        </Link>
      </div>
    </div>
  );
}
