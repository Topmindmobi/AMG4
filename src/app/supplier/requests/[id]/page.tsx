"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatKes, SUPPLY_STATUS_LABELS } from "@/lib/format";
import {
  confirmDemoSupplyRequest,
  getDemoSupplyRequest,
} from "@/lib/store/demo-store";
import type { SupplyRequest } from "@/lib/types";

export default function SupplierRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { supplierId } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<SupplyRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = getDemoSupplyRequest(params.id);
    if (r && supplierId && r.supplier_id !== supplierId) {
      router.replace("/supplier/requests");
      return;
    }
    setRequest(r);
  }, [params.id, supplierId, router]);

  function confirm() {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      const updated = confirmDemoSupplyRequest(request.id);
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm");
    } finally {
      setLoading(false);
    }
  }

  if (!request) {
    return <p className="text-sand/60">Loading request…</p>;
  }

  return (
    <div>
      <Link href="/supplier/requests" className="text-sm text-sand/50 hover:text-ember">
        ← All requests
      </Link>
      <h1 className="mt-4 font-display text-3xl text-sand">Supply request</h1>
      <p className="mt-2 text-sm text-sand/55">
        Status: {SUPPLY_STATUS_LABELS[request.status]}
      </p>

      <div className="mt-6 border border-white/10 bg-white/5 p-4 text-sm">
        <p className="text-sand/70">{request.delivery_note}</p>
        <p className="mt-3 text-xs text-sand/45">
          Order {request.order_id} · AMG client town: {request.customer_town}
        </p>
      </div>

      <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
        {request.items.map((item) => (
          <li key={item.order_item_id} className="flex justify-between py-3 text-sm">
            <span>
              {item.qty}× {item.name}
            </span>
            <span>{formatKes(item.price_kes * item.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right text-lg font-semibold text-ember">
        Total {formatKes(request.total_kes)}
      </p>

      {error && <p className="mt-4 text-sm text-ember">{error}</p>}

      {request.status === "pending" ? (
        <button
          type="button"
          disabled={loading}
          onClick={confirm}
          className="mt-6 bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Confirming…" : "Confirm I will supply these items"}
        </button>
      ) : (
        <p className="mt-6 text-sm text-sand/60">
          Confirmed{request.confirmed_at ? ` on ${new Date(request.confirmed_at).toLocaleString()}` : ""}.
          AMG admin will notify the buyer and arrange dispatch.
        </p>
      )}
    </div>
  );
}
