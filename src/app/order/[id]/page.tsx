"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { readStashedOrderConfirmation } from "@/lib/order-confirmation";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoOrder } from "@/lib/store/demo-store";
import type { Order } from "@/lib/types";

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    if (isDemoMode()) {
      setOrder(getDemoOrder(id));
      setLoading(false);
      return;
    }

    void (async () => {
      const stashed = readStashedOrderConfirmation(id);
      if (stashed) {
        setOrder(stashed);
        setLoading(false);
      }

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_order_confirmation",
          { p_order_id: id },
        );

        if (!rpcError && rpcData) {
          setOrder(rpcData as Order);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("id", id)
          .maybeSingle();

        if (data) {
          setOrder(data as Order);
        } else if (!stashed) {
          setOrder(null);
        }
      } catch {
        if (!stashed) setOrder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
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

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Order placed</p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,36px)] text-charcoal">Asante!</h1>
      <p className="mt-3 text-ink-soft">
        We&apos;ll confirm and arrange motorcycle delivery to {order.town}.
      </p>

      <dl className="mt-8 space-y-3 border-y border-line py-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Order</dt>
          <dd className="max-w-[60%] truncate font-mono text-xs">{order.id}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Status</dt>
          <dd>{ORDER_STATUS_LABELS[order.status] ?? order.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Payment</dt>
          <dd className="uppercase">{order.payment_method}</dd>
        </div>
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
