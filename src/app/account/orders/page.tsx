"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  formatKes,
  ORDER_STATUS_LABELS,
  RIDER_DELIVERY_STATUS_LABELS,
  RIDER_VEHICLE_LABELS,
} from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoOrders,
  normalizeRiderDeliveryStatus,
} from "@/lib/store/demo-store";
import type { Order } from "@/lib/types";

export default function AccountOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login?next=/account/orders");
      return;
    }
    if (!user) return;

    if (isDemoMode()) {
      const refresh = () => setOrders(getDemoOrders(user.id));
      refresh();
      const poll = setInterval(refresh, 5000);
      return () => clearInterval(poll);
    }

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
    })();
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="mx-auto max-w-3xl px-5 py-16 text-ink-soft">Loading orders…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">My orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-ink-soft">
          No orders yet.{" "}
          <Link href="/shop" className="font-semibold text-forest underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {orders.map((order) => {
            const riderStage = order.rider_id
              ? normalizeRiderDeliveryStatus(order)
              : null;
            const riderLabel =
              riderStage === "failed"
                ? "Fail delivery"
                : riderStage
                  ? RIDER_DELIVERY_STATUS_LABELS[riderStage] ?? riderStage
                  : null;
            return (
              <li key={order.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <Link href={`/order/${order.id}`} className="font-semibold hover:text-forest">
                    Order {order.id.slice(0, 12)}
                  </Link>
                  <p className="mt-1 text-xs text-ink-soft">
                    {new Date(order.created_at).toLocaleString()} ·{" "}
                    {ORDER_STATUS_LABELS[order.status]}
                    {order.rider_name_snapshot
                      ? ` · Rider: ${order.rider_name_snapshot}`
                      : ""}
                    {order.rider_vehicle_snapshot
                      ? ` (${RIDER_VEHICLE_LABELS[order.rider_vehicle_snapshot] ?? order.rider_vehicle_snapshot})`
                      : ""}
                    {riderLabel ? ` · ${riderLabel}` : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-ember">{formatKes(order.total_kes)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
