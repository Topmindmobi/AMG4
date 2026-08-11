"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CheckoutAuthGate } from "@/components/shop/CheckoutAuthGate";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { listDropoffPoints } from "@/lib/data/delivery";
import { formatKes, PAY_NOW_DISCOUNT_RATE, TOWNS } from "@/lib/format";
import { payNowWithMpesa } from "@/lib/mpesa/pay-now-client";
import {
  stashAccountCreatedNotice,
  stashOrderConfirmation,
  type AccountCreatedNotice,
  type PlacedOrderSnapshot,
} from "@/lib/order-confirmation";
import { isDemoMode } from "@/lib/supabase/config";
import { getErrorMessage } from "@/lib/supabase/errors";
import { submitOrder } from "@/lib/offline/order-queue";
import { createDemoOrder, ensureDemoCustomerAccount } from "@/lib/store/demo-store";
import type { DeliveryMethod, DropoffPoint, PaymentMethod, Town } from "@/lib/types";
import type { EnsureCustomerAccountResult } from "@/lib/auth/ensure-customer-account";

type PayState = "idle" | "processing" | "paid" | "failed";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { user, email, loading: authLoading } = useAuth();
  const router = useRouter();
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [town, setTown] = useState<Town>(user?.town ?? "Homabay");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("doorstep");
  const [dropoffPoints, setDropoffPoints] = useState<DropoffPoint[]>([]);
  const [dropoffPointId, setDropoffPointId] = useState<string>("");
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone ?? "");
  const [payState, setPayState] = useState<PayState>("idle");
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const needsAuthChoice = !authLoading && !user && !guestCheckout;

  useEffect(() => {
    let cancelled = false;
    void listDropoffPoints(town).then((points) => {
      if (cancelled) return;
      setDropoffPoints(points);
      setDropoffPointId((prev) => (points.some((p) => p.id === prev) ? prev : points[0]?.id ?? ""));
    });
    return () => {
      cancelled = true;
    };
  }, [town]);

  function selectPayment(method: PaymentMethod) {
    setPayment(method);
    setPayState("idle");
    setPayMessage(null);
  }

  const paid = payment === "mpesa" && payState === "paid";
  const discount = paid ? Math.round(total * PAY_NOW_DISCOUNT_RATE) : 0;
  const payable = total - discount;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Checkout</h1>
        <p className="mt-3 text-ink-soft">Your cart is empty.</p>
        <Link href="/shop" className="mt-6 inline-block font-semibold text-forest underline">
          Go to shop
        </Link>
      </div>
    );
  }

  async function payNow() {
    setPayState("processing");
    setPayMessage(null);
    const result = await payNowWithMpesa({
      phone: mpesaPhone,
      amountKes: total,
      accountRef: "AMGCOM",
    });
    if (result.paid) {
      setPayState("paid");
      setPayMessage(
        result.simulated
          ? "Payment confirmed (simulated — M-Pesa isn't connected in this environment)."
          : "Payment confirmed by M-Pesa.",
      );
    } else {
      setPayState("failed");
      setPayMessage(result.error);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (payment === "mpesa" && !paid) {
      setError("Confirm your M-Pesa payment above, or switch to cash on delivery.");
      return;
    }
    if (deliveryMethod === "dropoff" && !dropoffPointId) {
      setError("Choose a drop-off point.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const dropoff = dropoffPoints.find((p) => p.id === dropoffPointId) ?? null;
    const guestEmail = String(fd.get("email") || "").trim() || null;
    let userId = user?.id ?? null;
    let accountNotice: AccountCreatedNotice | null = null;

    if (!userId && !guestEmail) {
      setError("Email is required for guest checkout so we can create your temporary login.");
      return;
    }

    setLoading(true);

    // Guest checkout with email: create account if needed (additive — never blocks order).
    if (guestEmail && !userId) {
      try {
        if (isDemoMode()) {
          const ensured = ensureDemoCustomerAccount({
            email: guestEmail,
            fullName: String(fd.get("customer_name")),
            phone: String(fd.get("phone")),
            town,
          });
          if (ensured.userId) userId = ensured.userId;
          if (ensured.created || ensured.existed) {
            accountNotice = {
              email: ensured.email,
              created: ensured.created,
              temporaryPassword: ensured.temporaryPassword,
            };
          }
        } else {
          const res = await fetch("/api/auth/ensure-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: guestEmail,
              fullName: String(fd.get("customer_name")),
              phone: String(fd.get("phone")),
              town,
            }),
          });
          const ensured = (await res.json()) as EnsureCustomerAccountResult;
          if (ensured.userId) userId = ensured.userId;
          if (ensured.created || ensured.existed) {
            accountNotice = {
              email: ensured.email,
              created: ensured.created,
              temporaryPassword: ensured.temporaryPassword,
            };
          }
        }
      } catch {
        // Soft-fail: guest order continues without an account.
      }
    }

    const payload = {
      customer_name: String(fd.get("customer_name")),
      phone: String(fd.get("phone")),
      email: guestEmail,
      town,
      address:
        deliveryMethod === "doorstep"
          ? String(fd.get("address"))
          : `Drop-off: ${dropoff?.name ?? "AMG collection point"}`,
      payment_method: payment,
      mpesa_phone: payment === "mpesa" ? mpesaPhone || String(fd.get("phone")) : null,
      paid,
      delivery_method: deliveryMethod,
      dropoff_point_id: deliveryMethod === "dropoff" ? dropoffPointId : null,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price_kes: i.price_kes,
        qty: i.qty,
      })),
      user_id: userId,
    };

    try {
      if (isDemoMode()) {
        const order = createDemoOrder(payload);
        if (accountNotice) stashAccountCreatedNotice(order.id, accountNotice);
        clear();
        router.push(`/order/${order.id}`);
        return;
      }

      // Client-generated id + insert without RETURNING avoids RLS failure:
      // SELECT policies block guest rows (user_id null), and INSERT…RETURNING
      // requires the new row to pass SELECT as well. Same shape is reused as
      // the offline-queue payload when the device has no connectivity.
      const orderId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const discount_kes = paid ? Math.round(total * PAY_NOW_DISCOUNT_RATE) : 0;

      const orderRow = {
        id: orderId,
        user_id: payload.user_id,
        customer_name: payload.customer_name,
        phone: payload.phone,
        email: payload.email,
        town: payload.town,
        address: payload.address,
        payment_method: payload.payment_method,
        mpesa_phone: payload.mpesa_phone,
        paid: payload.paid,
        paid_at: payload.paid ? createdAt : null,
        subtotal_kes: total,
        discount_kes,
        delivery_method: payload.delivery_method,
        dropoff_point_id: payload.dropoff_point_id,
        dropoff_point_name: dropoff?.name ?? null,
        status: "pending",
        total_kes: total - discount_kes,
      };

      const lineItems = payload.items.map((i) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: i.productId,
        name_snapshot: i.name,
        price_kes: i.price_kes,
        qty: i.qty,
      }));

      const { queued } = await submitOrder(orderRow, lineItems);

      const snapshot: PlacedOrderSnapshot = {
        id: orderId,
        user_id: payload.user_id,
        customer_name: payload.customer_name,
        phone: payload.phone,
        email: payload.email,
        town: payload.town,
        address: payload.address,
        payment_method: payload.payment_method,
        mpesa_phone: payload.mpesa_phone,
        paid: payload.paid,
        paid_at: payload.paid ? createdAt : null,
        subtotal_kes: total,
        discount_kes,
        delivery_method: payload.delivery_method,
        dropoff_point_id: payload.dropoff_point_id,
        dropoff_point_name: dropoff?.name ?? null,
        rider_id: null,
        rider_name_snapshot: null,
        delivered_at: null,
        status: "pending",
        total_kes: total - discount_kes,
        created_at: createdAt,
        items: lineItems.map((i) => ({
          ...i,
          supplier_id: null,
          supplier_name_snapshot: null,
        })),
      };
      stashOrderConfirmation(snapshot);
      if (accountNotice) stashAccountCreatedNotice(orderId, accountNotice);

      clear();
      router.push(queued ? `/order/${orderId}?queued=1` : `/order/${orderId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not place order"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <CheckoutAuthGate open={needsAuthChoice} onCheckoutAsGuest={() => setGuestCheckout(true)} />

      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Checkout</h1>
      <p className="mt-2 text-[14.5px] text-ink-soft">
        Nationwide delivery across Kenya
      </p>

      {guestCheckout && !user && (
        <div className="mt-5 rounded-lg border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-charcoal">
          <p className="font-semibold text-forest-deep">Guest checkout</p>
          <p className="mt-1 text-ink-soft">
            Enter your email below. We&apos;ll create a temporary account so you can monitor this
            order at{" "}
            <Link href="/account/orders" className="font-semibold text-forest underline">
              My orders
            </Link>
            . Your login details appear on the confirmation page after you place the order.
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className={`mt-8 space-y-5 ${needsAuthChoice || authLoading ? "pointer-events-none opacity-40" : ""}`}
        aria-hidden={needsAuthChoice || authLoading}
      >
        <Field label="Full name" name="customer_name" defaultValue={user?.full_name ?? ""} required />
        <Field label="Phone" name="phone" defaultValue={user?.phone ?? ""} required />
        <Field
          label={
            user
              ? "Email"
              : "Email (required — temporary login for order monitoring)"
          }
          name="email"
          type="email"
          defaultValue={email ?? ""}
          required={!user}
        />
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Delivery town
          <select
            name="town"
            required
            value={town}
            onChange={(e) => setTown(e.target.value as Town)}
            className="amg-select mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-forest"
          >
            {TOWNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Delivery method
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={deliveryMethod === "doorstep"}
              onChange={() => setDeliveryMethod("doorstep")}
            />
            <span>
              <span className="font-medium">Deliver to my doorstep</span>
              <span className="block text-xs text-ink-soft">A rider brings it directly to you.</span>
            </span>
          </label>
          {deliveryMethod === "doorstep" && (
            <label className="block pl-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Address / landmark
              <textarea
                name="address"
                required
                rows={3}
                className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-forest"
                placeholder="Estate, building, or nearby landmark"
              />
            </label>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={deliveryMethod === "dropoff"}
              onChange={() => setDeliveryMethod("dropoff")}
            />
            <span>
              <span className="font-medium">Deliver to a drop-off point</span>
              <span className="block text-xs text-ink-soft">
                Pick it up yourself from an AMG collection point.
              </span>
            </span>
          </label>
          {deliveryMethod === "dropoff" && (
            <label className="block pl-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Drop-off point in {town}
              <select
                value={dropoffPointId}
                onChange={(e) => setDropoffPointId(e.target.value)}
                required
                className="amg-select mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal normal-case outline-none focus:border-forest"
              >
                {dropoffPoints.length === 0 && <option value="">No points available in {town}</option>}
                {dropoffPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {dropoffPoints.find((p) => p.id === dropoffPointId)?.description && (
                <span className="mt-1 block text-xs font-normal normal-case text-ink-soft">
                  {dropoffPoints.find((p) => p.id === dropoffPointId)?.description}
                </span>
              )}
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Payment</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              name="payment_method"
              checked={payment === "cod"}
              onChange={() => selectPayment("cod")}
            />
            <span>
              <span className="font-medium">Cash on delivery</span>
              <span className="block text-xs text-ink-soft">Pay the rider when your order arrives.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              name="payment_method"
              checked={payment === "mpesa"}
              onChange={() => selectPayment("mpesa")}
            />
            <span>
              <span className="font-medium text-forest-deep">
                Pay now with M-Pesa — save {Math.round(PAY_NOW_DISCOUNT_RATE * 100)}% instantly
              </span>
              <span className="block text-xs text-ink-soft">
                Confirm payment now and get {formatKes(Math.round(total * PAY_NOW_DISCOUNT_RATE))} off this order.
              </span>
            </span>
          </label>

          {payment === "mpesa" && (
            <div className="ml-6 space-y-3 rounded-lg border border-ember/30 bg-ember/5 p-3">
              <Field
                label="M-Pesa phone"
                name="mpesa_phone"
                value={mpesaPhone}
                onChange={(v) => {
                  setMpesaPhone(v);
                  setPayState("idle");
                }}
                required
              />
              {payState !== "paid" && (
                <button
                  type="button"
                  onClick={() => void payNow()}
                  disabled={payState === "processing" || !mpesaPhone}
                  className="w-full rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {payState === "processing" ? "Check your phone…" : "Send payment request"}
                </button>
              )}
              {payMessage && (
                <p
                  className={`text-xs font-medium ${
                    payState === "paid" ? "text-forest" : "text-ember"
                  }`}
                >
                  {payState === "paid" ? "✓ " : ""}
                  {payMessage}
                </p>
              )}
            </div>
          )}
        </fieldset>

        <dl className="space-y-1.5 border-y border-line py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd>{formatKes(total)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-forest">
              <dt>Pay-now discount ({Math.round(PAY_NOW_DISCOUNT_RATE * 100)}%)</dt>
              <dd>−{formatKes(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-charcoal">
            <dt>Total</dt>
            <dd>{formatKes(payable)}</dd>
          </div>
        </dl>

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading || (payment === "mpesa" && !paid)}
          className="w-full rounded-lg bg-ember py-3 text-[15px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
        >
          {loading ? "Placing order…" : `Place order — ${formatKes(payable)}`}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={onChange ? undefined : defaultValue}
        value={onChange ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
        className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-forest"
      />
    </label>
  );
}
