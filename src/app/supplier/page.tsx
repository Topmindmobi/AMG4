"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes, SUPPLY_STATUS_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoProductsBySupplier,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";
import type { Product, SupplyRequest } from "@/lib/types";

export default function SupplierDashboardPage() {
  const { supplierId } = useAuth();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!supplierId) return;

    if (isDemoMode()) {
      setRequests(getDemoSupplyRequests({ supplierId }));
      setProducts(getDemoProductsBySupplier(supplierId));
      return;
    }

    // Supply-request pipeline stays demo-only for now — that workflow (and its
    // RLS-backed table) isn't wired up in production yet. The product count
    // is a plain read, so it's safe to back with real data.
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
    })();
  }, [supplierId]);

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Supplier dashboard</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Manage your catalogue and move supply orders through the logistics pipeline.
      </p>
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
