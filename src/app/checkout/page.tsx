"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { formatKes, TOWNS } from "@/lib/format";
import {
  stashOrderConfirmation,
  type PlacedOrderSnapshot,
} from "@/lib/order-confirmation";
import { isDemoMode } from "@/lib/supabase/config";
import { getErrorMessage } from "@/lib/supabase/errors";
import { createDemoOrder } from "@/lib/store/demo-store";
import type { PaymentMethod, Town } from "@/lib/types";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cod");

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      customer_name: String(fd.get("customer_name")),
      phone: String(fd.get("phone")),
      town: String(fd.get("town")) as Town,
      address: String(fd.get("address")),
      payment_method: payment,
      mpesa_phone: payment === "mpesa" ? String(fd.get("mpesa_phone") || fd.get("phone")) : null,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price_kes: i.price_kes,
        qty: i.qty,
      })),
      user_id: user?.id ?? null,
    };

    try {
      if (isDemoMode()) {
        const order = createDemoOrder(payload);
        clear();
        router.push(`/order/${order.id}`);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Client-generated id + insert without RETURNING avoids RLS failure:
      // SELECT policies block guest rows (user_id null), and INSERT…RETURNING
      // requires the new row to pass SELECT as well.
      const orderId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const { error: orderError } = await supabase.from("orders").insert({
        id: orderId,
        user_id: payload.user_id,
        customer_name: payload.customer_name,
        phone: payload.phone,
        town: payload.town,
        address: payload.address,
        payment_method: payload.payment_method,
        mpesa_phone: payload.mpesa_phone,
        status: "pending",
        total_kes: total,
      });
      if (orderError) throw orderError;

      const lineItems = payload.items.map((i) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: i.productId,
        name_snapshot: i.name,
        price_kes: i.price_kes,
        qty: i.qty,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(lineItems);
      if (itemsError) throw itemsError;

      const snapshot: PlacedOrderSnapshot = {
        id: orderId,
        user_id: payload.user_id,
        customer_name: payload.customer_name,
        phone: payload.phone,
        town: payload.town,
        address: payload.address,
        payment_method: payload.payment_method,
        mpesa_phone: payload.mpesa_phone,
        status: "pending",
        total_kes: total,
        created_at: createdAt,
        items: lineItems.map((i) => ({
          ...i,
          supplier_id: null,
          supplier_name_snapshot: null,
        })),
      };
      stashOrderConfirmation(snapshot);

      clear();
      router.push(`/order/${orderId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not place order"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">Checkout</h1>
      <p className="mt-2 text-[14.5px] text-ink-soft">
        Total {formatKes(total)} · Delivery by motorcycle in Homabay, Mbita &amp; Migori
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Full name" name="customer_name" defaultValue={user?.full_name ?? ""} required />
        <Field label="Phone" name="phone" defaultValue={user?.phone ?? ""} required />
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Delivery town
          <select
            name="town"
            required
            defaultValue={user?.town ?? "Homabay"}
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
          >
            {TOWNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Address / landmark
          <textarea
            name="address"
            required
            rows={3}
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
            placeholder="Estate, building, or nearby landmark"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Payment</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="payment_method"
              checked={payment === "cod"}
              onChange={() => setPayment("cod")}
            />
            Cash on delivery
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="payment_method"
              checked={payment === "mpesa"}
              onChange={() => setPayment("mpesa")}
            />
            M-Pesa (pay on confirmation — STK coming soon)
          </label>
          {payment === "mpesa" && (
            <Field label="M-Pesa phone" name="mpesa_phone" defaultValue={user?.phone ?? ""} />
          )}
        </fieldset>

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ember py-3 text-[15px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
        >
          {loading ? "Placing order…" : "Place order"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
      />
    </label>
  );
}
