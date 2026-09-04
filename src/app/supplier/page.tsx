"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImpendingTaskBanner } from "@/components/dashboard/ImpendingTaskBanner";
import { useAuth } from "@/lib/auth-context";
import { listNotifications } from "@/lib/data/notifications";
import { formatKes, SUPPLY_STATUS_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoProductsBySupplier,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";
import type { AppNotification, Product, SupplyRequest } from "@/lib/types";

export default function SupplierDashboardPage() {
  const { user, supplierId } = useAuth();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!supplierId) return;

    if (isDemoMode()) {
      setRequests(getDemoSupplyRequests({ supplierId }));
      setProducts(getDemoProductsBySupplier(supplierId));
      return;
    }

    // supply_requests was made production-ready in migration 020 — this
    // used to skip fetching it entirely (stale comment claimed it was still
    // demo-only), which meant "New orders" on this dashboard always showed
    // 0 for real suppliers even though /supplier/requests itself already
    // queried this same table correctly.
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: reqData }, { data: prodData }] = await Promise.all([
        supabase
          .from("supply_requests")
          .select("*")
          .eq("supplier_id", supplierId)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("*")
          .eq("supplier_id", supplierId)
          .order("created_at", { ascending: false }),
      ]);
      setRequests((reqData as SupplyRequest[]) ?? []);
      setProducts((prodData as Product[]) ?? []);
    })();
  }, [supplierId]);

  useEffect(() => {
    if (!user) return;
    void listNotifications(user.id).then(setNotifications);
  }, [user]);

  const pending = requests.filter((r) => r.status === "pending").length;
  const unreadNote = notifications.find((n) => !n.read) ?? null;
  const impendingTask =
    pending > 0
      ? {
          title: `${pending} new order${pending === 1 ? "" : "s"} awaiting your confirmation`,
          href: "/supplier/requests",
          linkLabel: "Open kanban",
        }
      : unreadNote
        ? {
            title: unreadNote.title,
            description: unreadNote.body,
            href: unreadNote.link ?? "/supplier",
            linkLabel: "View",
          }
        : null;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Supplier dashboard</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Manage your catalogue and move supply orders through the logistics pipeline.
      </p>

      {impendingTask && (
        <div className="mt-6">
          <ImpendingTaskBanner {...impendingTask} />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New orders" value={String(pending)} />
        <Stat
          label="Confirmed"
          value={String(requests.filter((r) => r.status === "confirmed").length)}
        />
        <Stat
          label="Dispatched"
          value={String(requests.filter((r) => r.status === "dispatched").length)}
        />
        <Stat
          label="Fulfilled"
          value={String(requests.filter((r) => r.status === "fulfilled").length)}
        />
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        {products.length} products in your catalogue ·{" "}
        <Link href="/supplier/inventory" className="text-ember hover:underline">
          Inventory
        </Link>
        {" · "}
        <Link href="/supplier/addresses" className="text-ember hover:underline">
          Addresses
        </Link>
        {" · "}
        <Link href="/supplier/reports" className="text-ember hover:underline">
          Reports
        </Link>
      </p>
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-charcoal">Recent pipeline</h2>
          <Link href="/supplier/requests" className="text-sm text-ember">
            Open kanban
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {requests.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/supplier/requests/${r.id}`} className="hover:text-ember">
                {r.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                <span className="mt-1 block text-xs text-ink-soft">
                  {SUPPLY_STATUS_LABELS[r.status]} · {r.customer_town}
                </span>
              </Link>
              <span className="text-ember">{formatKes(r.total_kes)}</span>
            </li>
          ))}
        </ul>
        {requests.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">No supply requests yet.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-2xl text-charcoal">{value}</p>
    </div>
  );
}
