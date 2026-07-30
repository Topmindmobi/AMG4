"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes, SUPPLY_STATUS_LABELS } from "@/lib/format";
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
    setRequests(getDemoSupplyRequests({ supplierId }));
    setProducts(getDemoProductsBySupplier(supplierId));
  }, [supplierId]);

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Supplier dashboard</h1>
      <p className="mt-2 text-sm text-sand/55">
        Manage your catalogue and respond to AMG.COM supply requests.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Pending requests" value={String(pending)} />
        <Stat label="All requests" value={String(requests.length)} />
        <Stat label="Your products" value={String(products.length)} />
      </div>
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-sand">Recent requests</h2>
          <Link href="/supplier/requests" className="text-sm text-ember">
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {requests.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/supplier/requests/${r.id}`} className="hover:text-ember">
                {r.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                <span className="mt-1 block text-xs text-sand/45">
                  {SUPPLY_STATUS_LABELS[r.status]} · {r.customer_town}
                </span>
              </Link>
              <span className="text-ember">{formatKes(r.total_kes)}</span>
            </li>
          ))}
        </ul>
        {requests.length === 0 && (
          <p className="mt-4 text-sm text-sand/50">No supply requests yet.</p>
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
