"use client";

import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoCallbackRequests, setDemoCallbackStatus } from "@/lib/store/demo-store";
import type { CallbackRequest, CallbackRequestStatus } from "@/lib/types";

const STATUS_LABEL: Record<CallbackRequestStatus, string> = {
  pending: "Pending",
  contacted: "Contacted",
  resolved: "Resolved",
};

export default function AdminCallbacksPage() {
  const [requests, setRequests] = useState<CallbackRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(() => {
    if (isDemoMode()) {
      setRequests(getDemoCallbackRequests());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("callback_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests((data as CallbackRequest[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: CallbackRequestStatus) {
    setBusyId(id);
    try {
      if (isDemoMode()) {
        setDemoCallbackStatus(id, status);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.rpc("set_callback_status", { p_id: id, p_status: status });
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === "open" ? requests.filter((r) => r.status === "pending") : requests;
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Order on call</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Customers who left their number instead of checking out online. Call them back to take
        the order.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("open")}
          className={`border px-3 py-1.5 text-xs font-medium ${
            filter === "open"
              ? "border-ember text-ember"
              : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`border px-3 py-1.5 text-xs font-medium ${
            filter === "all"
              ? "border-ember text-ember"
              : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          All ({requests.length})
        </button>
      </div>

      <ul className="mt-8 space-y-4">
        {visible.map((r) => (
          <li key={r.id} className="border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.customer_name}</p>
                <p className="mt-1 text-sm text-charcoal">
                  <a href={`tel:${r.phone}`} className="font-semibold text-forest hover:underline">
                    {r.phone}
                  </a>
                </p>
                {r.note && <p className="mt-2 text-sm text-ink-soft">{r.note}</p>}
                <p className="mt-2 text-xs text-ink-soft">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    r.status === "pending"
                      ? "text-ember"
                      : r.status === "contacted"
                        ? "text-forest"
                        : "text-ink-soft"
                  }`}
                >
                  {STATUS_LABEL[r.status]}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {r.status === "pending" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, "contacted")}
                      className="border border-forest px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-50"
                    >
                      Mark contacted
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, "resolved")}
                      className="border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-charcoal disabled:opacity-50"
                    >
                      Mark resolved
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
          {filter === "open" ? "No pending callback requests." : "No callback requests yet."}
        </p>
      )}
    </div>
  );
}
