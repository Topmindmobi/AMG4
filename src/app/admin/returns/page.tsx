"use client";

import { useCallback, useEffect, useState } from "react";
import { formatKes, RETURN_REASON_LABELS, RETURN_STATUS_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { adminResolveDemoReturn, getDemoOrder, getDemoReturnRequests } from "@/lib/store/demo-store";
import type { Order, ReturnRequest, ReturnRequestStatus } from "@/lib/types";

/** A return request plus the display data admin needs but the row itself doesn't carry. */
interface ReturnRow extends ReturnRequest {
  customerName: string;
  itemLines: string[];
}

export default function AdminReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(() => {
    if (isDemoMode()) {
      const requests = getDemoReturnRequests();
      const withDisplay = requests.map((r): ReturnRow => {
        const order = getDemoOrder(r.order_id);
        const itemLines = (r.items ?? []).map((it) => {
          const item = order?.items?.find((oi) => oi.id === it.order_item_id);
          return `${item?.name_snapshot ?? "Item"} × ${it.qty}`;
        });
        return { ...r, customerName: order?.customer_name ?? "Unknown", itemLines };
      });
      setRows(withDisplay);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("return_requests")
        .select("*, items:return_request_items(*)")
        .order("requested_at", { ascending: false });
      const requests = (data as ReturnRequest[]) ?? [];
      const orderIds = Array.from(new Set(requests.map((r) => r.order_id)));
      const { data: ordersData } = orderIds.length
        ? await supabase.from("orders").select("id, customer_name, items:order_items(*)").in("id", orderIds)
        : { data: [] };
      const ordersById = new Map(((ordersData as Order[]) ?? []).map((o) => [o.id, o]));
      const withDisplay = requests.map((r): ReturnRow => {
        const order = ordersById.get(r.order_id);
        const itemLines = (r.items ?? []).map((it) => {
          const item = order?.items?.find((oi) => oi.id === it.order_item_id);
          return `${item?.name_snapshot ?? "Item"} × ${it.qty}`;
        });
        return { ...r, customerName: order?.customer_name ?? "Unknown", itemLines };
      });
      setRows(withDisplay);
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(
    id: string,
    status: Extract<ReturnRequestStatus, "approved" | "rejected" | "refunded">,
  ) {
    const adminNotes =
      status === "rejected"
        ? window.prompt("Reason for rejecting this return (shown to the customer):") ?? undefined
        : undefined;
    if (status === "rejected" && adminNotes === undefined) return;

    let refundAmountKes: number | null = null;
    if (status === "refunded") {
      const raw = window.prompt("Refund amount (KES) already paid to the customer:");
      if (raw === null) return;
      refundAmountKes = Number(raw);
      if (!Number.isFinite(refundAmountKes) || refundAmountKes < 0) {
        window.alert("Enter a valid refund amount");
        return;
      }
    }

    setBusyId(id);
    try {
      if (isDemoMode()) {
        adminResolveDemoReturn({ returnId: id, status, adminNotes, refundAmountKes });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("admin_resolve_return", {
          p_return_id: id,
          p_status: status,
          p_admin_notes: adminNotes ?? null,
          p_refund_amount_kes: refundAmountKes,
        });
        if (error) throw error;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === "open" ? rows.filter((r) => r.status === "requested" || r.status === "approved") : rows;
  const openCount = rows.filter((r) => r.status === "requested" || r.status === "approved").length;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Returns</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Customer return requests, within 7 days of delivery. Approve, reject, or mark a return
        refunded once the payment has been handled outside the app.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("open")}
          className={`border px-3 py-1.5 text-xs font-medium ${
            filter === "open" ? "border-ember text-ember" : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          Open ({openCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`border px-3 py-1.5 text-xs font-medium ${
            filter === "all" ? "border-ember text-ember" : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          All ({rows.length})
        </button>
      </div>

      <ul className="mt-8 space-y-4">
        {visible.map((r) => (
          <li key={r.id} className="border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.customerName}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Order {r.order_id.slice(0, 8)} · {new Date(r.requested_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-charcoal">{RETURN_REASON_LABELS[r.reason]}</p>
                {r.reason_notes && <p className="mt-1 text-sm text-ink-soft">{r.reason_notes}</p>}
                {r.itemLines.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {r.itemLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
                {r.status === "refunded" && r.refund_amount_kes != null && (
                  <p className="mt-2 text-sm font-semibold text-forest-deep">
                    Refunded {formatKes(r.refund_amount_kes)}
                  </p>
                )}
                {r.admin_notes && r.status === "rejected" && (
                  <p className="mt-2 text-sm text-ember">Rejected: {r.admin_notes}</p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    r.status === "requested"
                      ? "text-ember"
                      : r.status === "approved"
                        ? "text-forest"
                        : r.status === "refunded"
                          ? "text-forest-deep"
                          : "text-ink-soft"
                  }`}
                >
                  {RETURN_STATUS_LABELS[r.status]}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {r.status === "requested" && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void resolve(r.id, "approved")}
                        className="border border-forest px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void resolve(r.id, "rejected")}
                        className="border border-ember px-3 py-1.5 text-xs font-semibold text-ember hover:bg-ember/5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void resolve(r.id, "refunded")}
                      className="border border-forest px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-50"
                    >
                      Mark refunded
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="mt-8 text-sm text-ink-soft">
          {filter === "open" ? "No open return requests." : "No return requests yet."}
        </p>
      )}
    </div>
  );
}
