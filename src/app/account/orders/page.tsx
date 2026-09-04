"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductThumb } from "@/components/shared/ProductThumb";
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
  getDemoProducts,
  normalizeRiderDeliveryStatus,
} from "@/lib/store/demo-store";
import type { Order, Product } from "@/lib/types";

export default function AccountOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsById, setProductsById] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login?next=/account/orders");
      return;
    }
    if (!user) return;

    if (isDemoMode()) {
      const refresh = () => {
        setOrders(getDemoOrders(user.id));
        setProductsById(new Map(getDemoProducts({ activeOnly: false }).map((p) => [p.id, p])));
      };
      refresh();
      const poll = setInterval(refresh, 5000);
      return () => clearInterval(poll);
    }

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = (data as Order[]) ?? [];
      setOrders(list);

      // order_items only snapshots name/price/qty, not a product image — a
      // thumbnail needs a real lookup. RLS only lets a customer read
      // active+reviewed products, so an item whose product was since
      // deactivated just falls back to the placeholder icon below.
      const productIds = Array.from(
        new Set(
          list.flatMap((o) => (o.items ?? []).map((i) => i.product_id).filter((id): id is string => Boolean(id))),
        ),
      );
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, slug, image_path")
          .in("id", productIds);
        setProductsById(new Map(((prods as Product[]) ?? []).map((p) => [p.id, p])));
      }
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
            const items = order.items ?? [];
            return (
              <li key={order.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {(items.length > 0 ? items : [null]).slice(0, 3).map((item, i) => (
                      <ProductThumb
                        key={item?.id ?? i}
                        product={item?.product_id ? productsById.get(item.product_id) : null}
                        size={44}
                        className="border-2 border-white"
                      />
                    ))}
                  </div>
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
