"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes, SUPPLY_STATUS_LABELS } from "@/lib/format";
import { getDemoSupplyRequests } from "@/lib/store/demo-store";
import type { SupplyRequest } from "@/lib/types";

export default function SupplierRequestsPage() {
  const { supplierId } = useAuth();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);

  useEffect(() => {
    if (!supplierId) return;
    setRequests(getDemoSupplyRequests({ supplierId }));
  }, [supplierId]);

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Supply requests</h1>
      <p className="mt-2 text-sm text-sand/55">
        AMG.COM will ask you to supply items for their clients. Confirm when you can fulfil.
      </p>
      <ul className="mt-8 space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/supplier/requests/${r.id}`}
                  className="font-medium hover:text-ember"
                >
                  Request {r.id.slice(0, 12)}
                </Link>
                <p className="mt-1 text-xs text-sand/50">
                  Order {r.order_id} · Deliver for AMG client in {r.customer_town}
                </p>
                <p className="mt-2 text-sm text-sand/70">
                  {r.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ember">{formatKes(r.total_kes)}</p>
                <p className="mt-1 text-xs text-sand/45">
                  {SUPPLY_STATUS_LABELS[r.status]}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {requests.length === 0 && (
        <p className="mt-8 text-sm text-sand/50">No requests yet.</p>
      )}
    </div>
  );
}
