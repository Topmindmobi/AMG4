"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes, RETURN_REASON_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoOrder, isDemoReturnWindowOpen, requestDemoReturn } from "@/lib/store/demo-store";
import type { Order, ReturnReason } from "@/lib/types";

const REASONS: ReturnReason[] = ["damaged", "wrong_item", "not_as_described", "changed_mind", "other"];

export default function RequestReturnPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    async function fetchOrder(): Promise<Order | null> {
      if (isDemoMode()) return getDemoOrder(id);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("id", id)
        .maybeSingle();
      return (data as Order) ?? null;
    }

    void fetchOrder().then((o) => {
      setOrder(o);
      setLoading(false);
    });
  }, [params.id]);

  if (loading || authLoading) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-ink-soft">Loading order…</div>;
  }

  if (!order || !user || order.user_id !== user.id) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[clamp(28px,4vw,34px)] text-charcoal">Order not available</h1>
        <p className="mt-3 text-ink-soft">
          You can only request a return on your own order. Open{" "}
          <Link href="/account/orders" className="font-semibold text-forest underline">
            My orders
          </Link>
          .
        </p>
      </div>
    );
  }

  const windowOpen = isDemoMode()
    ? isDemoReturnWindowOpen(order.id)
    : Boolean(order.delivered_at) &&
      Date.now() <= new Date(order.delivered_at!).getTime() + 7 * 24 * 3600_000;

  if (order.status !== "delivered" || !windowOpen) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-[clamp(28px,4vw,34px)] text-charcoal">
          Return unavailable
        </h1>
        <p className="mt-3 text-ink-soft">
          Returns can only be requested within 7 days of delivery.
        </p>
        <Link href={`/order/${order.id}`} className="mt-4 inline-block font-semibold text-forest underline">
          Back to order
        </Link>
      </div>
    );
  }

  const items = order.items ?? [];
  const selectedItems = items.filter((item) => (selectedQty[item.id] ?? 0) > 0);

  async function submit() {
    if (!order || !user) return;
    if (selectedItems.length === 0) {
      setError("Select at least one item to return");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = selectedItems.map((item) => ({
        orderItemId: item.id,
        qty: selectedQty[item.id],
      }));
      if (isDemoMode()) {
        requestDemoReturn({
          orderId: order.id,
          userId: user.id,
          reason,
          reasonNotes: notes,
          items: payload,
        });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: rpcError } = await supabase.rpc("request_return", {
          p_order_id: order.id,
          p_reason: reason,
          p_reason_notes: notes,
          p_items: payload.map((p) => ({ order_item_id: p.orderItemId, qty: p.qty })),
        });
        if (rpcError) throw rpcError;
      }
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit return request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Request a return</p>
      <h1 className="mt-2 font-display text-[clamp(28px,4vw,34px)] text-charcoal">
        Order {order.id.slice(0, 8)}
      </h1>

      <div className="mt-8">
        <p className="text-sm font-semibold text-charcoal">1. Which item(s) are you returning?</p>
        <ul className="mt-3 space-y-3">
          {items.map((item) => {
            const qty = selectedQty[item.id] ?? 0;
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-charcoal">{item.name_snapshot}</p>
                  <p className="text-xs text-ink-soft">
                    {item.qty} ordered · {formatKes(item.price_kes)} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQty((prev) => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))
                    }
                    className="h-7 w-7 rounded border border-line text-sm font-semibold text-ink-soft hover:bg-sand"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-semibold">{qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQty((prev) => ({
                        ...prev,
                        [item.id]: Math.min(item.qty, qty + 1),
                      }))
                    }
                    className="h-7 w-7 rounded border border-line text-sm font-semibold text-ink-soft hover:bg-sand"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6">
        <label className="text-sm font-semibold text-charcoal" htmlFor="return-reason">
          2. Why are you returning it?
        </label>
        <select
          id="return-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReturnReason)}
          className="amg-select mt-2 w-full border border-line bg-white px-3 py-2 text-sm"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {RETURN_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <label className="text-sm font-semibold text-charcoal" htmlFor="return-notes">
          3. Anything else we should know? (optional)
        </label>
        <textarea
          id="return-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="Describe the issue"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white hover:bg-ember-deep disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit return request"}
        </button>
        <Link href={`/order/${order.id}`} className="text-sm font-semibold text-forest underline">
          Cancel
        </Link>
      </div>
    </div>
  );
}
