"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKes } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoOrders,
  getDemoProducts,
} from "@/lib/store/demo-store";
import type { Order, Product } from "@/lib/types";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (isDemoMode()) {
      setOrders(getDemoOrders());
      setProducts(getDemoProducts({ activeOnly: false }));
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*"),
      ]);
      setOrders((o as Order[]) ?? []);
      setProducts((p as Product[]) ?? []);
    })();
  }, []);

  const pending = orders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter((p) => p.is_active && p.stock <= 5);
  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_kes), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-sand">Dashboard</h1>
          <p className="mt-2 text-sm text-sand/55">
            Homabay &amp; Migori operations overview
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="border border-ember/50 px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10"
        >
          Open reports
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Pending" value={String(pending)} />
        <Stat label="Revenue (excl. cancelled)" value={formatKes(revenue)} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl text-sand">Low stock</h2>
        {lowStock.length === 0 ? (
          <p className="mt-3 text-sm text-sand/50">All active products are above 5 units.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between py-3 text-sm">
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
    <div className="border border-white/10 bg-white/5 px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-sand/45">{label}</p>
      <p className="mt-2 font-display text-2xl text-sand">{value}</p>
    </div>
  );
}
