"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RiderDeliveryTracker } from "@/components/orders/RiderDeliveryTracker";
import { StarRating } from "@/components/shared/StarRating";
import { useAuth } from "@/lib/auth-context";
import {
  DELIVERY_METHOD_LABELS,
  formatKes,
  RETURN_STATUS_LABELS,
  RETURN_TRACKING_STEPS,
} from "@/lib/format";
import {
  readAccountCreatedNotice,
  readStashedOrderConfirmation,
  type AccountCreatedNotice,
} from "@/lib/order-confirmation";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoOrder,
  getDemoOrderRating,
  getDemoProductRatings,
  getDemoReturnRequestForOrder,
  isDemoReturnWindowOpen,
  submitDemoOrderRating,
} from "@/lib/store/demo-store";
import type { Order, OrderRating, OrderStatus, ProductRating, ReturnRequest } from "@/lib/types";

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

  const [orderRating, setOrderRating] = useState<OrderRating | null>(null);
  const [productRatings, setProductRatings] = useState<ProductRating[]>([]);
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [returnWindowOpen, setReturnWindowOpen] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!order || order.status !== "delivered") return;
    const orderId = order.id;
    const deliveredAt = order.delivered_at;

    async function loadPostDeliveryState() {
      if (isDemoMode()) {
        const rating = getDemoOrderRating(orderId);
        setOrderRating(rating);
        setProductRatings(getDemoProductRatings(orderId));
        setReturnRequest(getDemoReturnRequestForOrder(orderId));
        setReturnWindowOpen(isDemoReturnWindowOpen(orderId));
        if (rating) {
          setOverallRating(rating.overall_rating);
          setDeliveryRating(rating.delivery_rating);
          setReviewText(rating.review_text ?? "");
        }
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: ratingData }, { data: productData }, { data: returnData }] = await Promise.all([
        supabase.from("order_ratings").select("*").eq("order_id", orderId).maybeSingle(),
        supabase.from("product_ratings").select("*").eq("order_id", orderId),
        supabase
          .from("return_requests")
          .select("*, items:return_request_items(*)")
          .eq("order_id", orderId)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const rating = (ratingData as OrderRating | null) ?? null;
      setOrderRating(rating);
      setProductRatings((productData as ProductRating[]) ?? []);
      setReturnRequest((returnData as ReturnRequest | null) ?? null);
      setReturnWindowOpen(
        Boolean(deliveredAt) && Date.now() <= new Date(deliveredAt!).getTime() + 7 * 24 * 3600_000,
      );
      if (rating) {
        setOverallRating(rating.overall_rating);
        setDeliveryRating(rating.delivery_rating);
        setReviewText(rating.review_text ?? "");
      }
    }

    void loadPostDeliveryState();
  }, [order?.id, order?.status, order?.delivered_at]);

  async function submitRating() {
    if (!order || !user) return;
    setRatingBusy(true);
    setRatingMessage(null);
    try {
      const productPayload = (order.items ?? [])
        .filter((item) => itemRatings[item.id] > 0)
        .map((item) => ({ orderItemId: item.id, rating: itemRatings[item.id] }));

      if (isDemoMode()) {
        const rating = submitDemoOrderRating({
          orderId: order.id,
          userId: user.id,
          overallRating,
          deliveryRating,
          reviewText,
          productRatings: productPayload,
        });
        setOrderRating(rating);
        setProductRatings(getDemoProductRatings(order.id));
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase.rpc("submit_order_rating", {
          p_order_id: order.id,
          p_overall_rating: overallRating,
          p_delivery_rating: deliveryRating,
          p_review_text: reviewText,
          p_product_ratings: productPayload.map((p) => ({
            order_item_id: p.orderItemId,
            rating: p.rating,
          })),
        });
        if (error) throw error;
        setOrderRating(data as OrderRating);
        const { data: productData } = await supabase
          .from("product_ratings")
          .select("*")
          .eq("order_id", order.id);
        setProductRatings((productData as ProductRating[]) ?? []);
      }
      setRatingMessage("Thanks — your review has been saved.");
    } catch (err) {
      setRatingMessage(err instanceof Error ? err.message : "Could not save your rating");
    } finally {
      setRatingBusy(false);
    }
  }

  if (loading || authLoading) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading order…</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">Order not found</h1>
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
        <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">
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
  const canActAsOwner =
    Boolean(user) && !isAdmin && Boolean(order.user_id) && order.user_id === user!.id;

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Track your order</p>
      <h1 className="mt-2 font-display text-[clamp(30px,4vw,38px)] text-charcoal">Asante!</h1>
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
                <p className={`mt-2 text-[13px] font-semibold ${done ? "text-forest-deep" : "text-ink-soft"}`}>
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

      {canActAsOwner && order.status === "delivered" && (
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="font-display text-xl text-charcoal">Rate your order</h2>
          {ratingMessage && <p className="mt-2 text-sm text-forest-deep">{ratingMessage}</p>}
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-charcoal">Overall experience</p>
              <StarRating value={overallRating} onChange={setOverallRating} label="Overall rating" />
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal">Delivery</p>
              <StarRating value={deliveryRating} onChange={setDeliveryRating} label="Delivery rating" />
            </div>
            {order.items && order.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-charcoal">Products</p>
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-soft">{item.name_snapshot}</span>
                    <StarRating
                      value={
                        itemRatings[item.id] ??
                        productRatings.find((r) => r.order_item_id === item.id)?.rating ??
                        0
                      }
                      onChange={(n) => setItemRatings((prev) => ({ ...prev, [item.id]: n }))}
                      size={18}
                      label={`Rate ${item.name_snapshot}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-charcoal" htmlFor="review-text">
                Notes (optional)
              </label>
              <textarea
                id="review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                placeholder="Tell us about your experience"
              />
            </div>
            <button
              type="button"
              disabled={ratingBusy || overallRating === 0 || deliveryRating === 0}
              onClick={() => void submitRating()}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-deep disabled:opacity-50"
            >
              {orderRating ? "Update review" : "Submit review"}
            </button>
          </div>
        </div>
      )}

      {canActAsOwner && order.status === "delivered" && (
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="font-display text-xl text-charcoal">Returns</h2>
          {returnRequest ? (
            <div className="mt-4">
              <ol className="grid grid-cols-3 gap-1">
                {RETURN_TRACKING_STEPS.map((step, i) => {
                  const rejected = returnRequest.status === "rejected";
                  const activeIndex = rejected
                    ? -1
                    : RETURN_TRACKING_STEPS.findIndex((s) => s === returnRequest.status);
                  const done = !rejected && i <= activeIndex;
                  return (
                    <li key={step} className="flex flex-col items-center text-center">
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
                          className={`h-0.5 flex-1 ${i === RETURN_TRACKING_STEPS.length - 1 ? "opacity-0" : i < activeIndex ? "bg-forest" : "bg-line"}`}
                        />
                      </div>
                      <p className={`mt-2 text-[13px] font-semibold ${done ? "text-forest-deep" : "text-ink-soft"}`}>
                        {RETURN_STATUS_LABELS[step]}
                      </p>
                    </li>
                  );
                })}
              </ol>
              {returnRequest.status === "rejected" && (
                <p className="mt-3 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ember">
                  Return request rejected
                  {returnRequest.admin_notes ? `: ${returnRequest.admin_notes}` : "."}
                </p>
              )}
            </div>
          ) : returnWindowOpen ? (
            <>
              <p className="mt-2 text-sm text-ink-soft">
                Not quite right? You can request a return within 7 days of delivery.
              </p>
              <Link
                href={`/order/${order.id}/return`}
                className="mt-3 inline-block rounded-lg border border-ember px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10"
              >
                Request a return
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              The 7-day return window for this order has closed.
            </p>
          )}
        </div>
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
