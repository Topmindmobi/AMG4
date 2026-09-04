"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImpendingTaskBanner } from "@/components/dashboard/ImpendingTaskBanner";
import { useAuth } from "@/lib/auth-context";
import { listNotifications } from "@/lib/data/notifications";
import { formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoOrders,
  getDemoProducts,
  getDemoRoleApplications,
} from "@/lib/store/demo-store";
import type { AppNotification, Order, OrderStatus, Product } from "@/lib/types";

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: "bg-ember/10 text-ember-deep",
  awaiting_supplier: "bg-ember/10 text-ember-deep",
  supplier_confirmed: "bg-ember/10 text-ember-deep",
  confirmed: "bg-forest/10 text-forest",
  out_for_delivery: "bg-forest/10 text-forest",
  delivered: "bg-line text-ink-soft",
  cancelled: "bg-crimson/10 text-crimson",
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (isDemoMode()) {
      void Promise.resolve().then(() => {
        setOrders(getDemoOrders());
        setProducts(getDemoProducts({ activeOnly: false }));
        setPendingApplications(
          getDemoRoleApplications().filter((a) => a.status === "pending").length,
        );
      });
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: o }, { data: p }, { count: appCount }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*"),
        supabase
          .from("role_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setOrders((o as Order[]) ?? []);
      setProducts((p as Product[]) ?? []);
      setPendingApplications(appCount ?? 0);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    void listNotifications(user.id).then(setNotifications);
  }, [user]);

  const pending = orders.filter((o) => o.status === "pending").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const lowStock = products.filter((p) => p.is_active && p.stock <= 5);
  const needsMarkupReview = products.filter((p) => p.is_active && !p.markup_type).length;
  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_kes), 0);
  const recentOrders = orders.slice(0, 8);

  // Most urgent thing right now, in priority order — the first one with
  // something in it wins. Falls back to the latest unread notification
  // (e.g. a message from another admin, or a system alert) when the
  // operational queues are all clear.
  const unreadNote = notifications.find((n) => !n.read) ?? null;
  const impendingTask =
    pending > 0
      ? {
          title: `${pending} new order${pending === 1 ? "" : "s"} awaiting confirmation`,
          href: "/admin/orders",
          linkLabel: "Review orders",
        }
      : needsMarkupReview > 0
        ? {
            title: `${needsMarkupReview} product${needsMarkupReview === 1 ? "" : "s"} awaiting markup review`,
            description: "Hidden from customers until reviewed.",
            href: "/admin/products",
            linkLabel: "Review products",
          }
        : pendingApplications > 0
          ? {
              title: `${pendingApplications} supplier/rider application${pendingApplications === 1 ? "" : "s"} awaiting review`,
              href: "/admin/applications",
              linkLabel: "Review applications",
            }
          : unreadNote
            ? {
                title: unreadNote.title,
                description: unreadNote.body,
                href: unreadNote.link ?? "/admin",
                linkLabel: "View",
              }
            : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Dashboard</h1>
          <p className="mt-2 text-base text-ink-soft">
            Nationwide operations overview
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="border border-ember/50 px-4 py-2 text-base font-semibold text-ember hover:bg-ember/10"
        >
          Open reports
        </Link>
      </div>

      {impendingTask && (
        <div className="mt-6">
          <ImpendingTaskBanner {...impendingTask} />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Pending" value={String(pending)} />
        <Stat label="Confirmed" value={String(confirmed)} />
        <Stat label="Revenue (excl. cancelled)" value={formatKes(revenue)} />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl text-charcoal">Recent orders</h2>
          <Link href="/admin/orders" className="text-base font-semibold text-ember hover:text-ember-deep">
            Manage all orders →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="mt-3 text-base text-ink-soft">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/order/${order.id}`} className="font-medium text-charcoal hover:text-ember">
                    {order.customer_name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {order.town} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-charcoal">{formatKes(Number(order.total_kes))}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-semibold ${STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-charcoal">Low stock</h2>
        {lowStock.length === 0 ? (
          <p className="mt-3 text-base text-ink-soft">All active products are above 5 units.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between py-3 text-base">
                <span>{p.name}</span>
                <span className="text-ember">{p.stock} left</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white px-4 py-5">
      <p className="text-sm uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-3xl text-charcoal">{value}</p>
    </div>
  );
}
