"use client";

import { useCallback, useEffect, useState } from "react";
import { SupplyKanban } from "@/components/supplier/SupplyKanban";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/supabase/config";
import {
  confirmDemoSupplyRequest,
  dispatchDemoSupplyRequest,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";
import type {
  SupplyDispatchDetails,
  SupplyLogisticsPlan,
  SupplyRequest,
  SupplyRequestStatus,
} from "@/lib/types";

export default function SupplierRequestsPage() {
  const { supplierId } = useAuth();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!supplierId) return;
    if (isDemoMode()) {
      setRequests(getDemoSupplyRequests({ supplierId }));
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("supply_requests")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      setRequests((data as SupplyRequest[]) ?? []);
    })();
  }, [supplierId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onMove(
    requestId: string,
    to: SupplyRequestStatus,
    extras?: { logistics?: SupplyLogisticsPlan; dispatch?: SupplyDispatchDetails },
  ) {
    setMessage(null);
    try {
      if (to === "confirmed") {
        if (!extras?.logistics) throw new Error("Logistics plan required");
        if (isDemoMode()) {
          confirmDemoSupplyRequest(requestId, extras.logistics);
        } else {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { error } = await supabase.rpc("supplier_confirm_supply_request", {
            p_request_id: requestId,
            p_logistics: extras.logistics,
          });
          if (error) throw error;
        }
        setMessage("Confirmed with logistics plan — card moved to Confirmed.");
        reload();
        return;
      }
      if (to === "dispatched") {
        if (!extras?.dispatch) throw new Error("Driver and vehicle details required");
        if (isDemoMode()) {
          dispatchDemoSupplyRequest(requestId, extras.dispatch);
        } else {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { error } = await supabase.rpc("supplier_dispatch_supply_request", {
            p_request_id: requestId,
            p_dispatch: extras.dispatch,
          });
          if (error) throw error;
        }
        setMessage(
          `Dispatched with ${extras.dispatch.vehicle_type.toUpperCase()} ${extras.dispatch.vehicle_plate}. AMG will inspect on arrival.`,
        );
        reload();
        return;
      }
      if (to === "fulfilled") {
        setMessage("Only AMG can certify fulfilled after inspection.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update status");
      throw err;
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Orders pipeline</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Drag cards between columns to update status. Confirming requires a logistics plan; dispatching
        requires driver and vehicle (boda / van / truck) details. Fulfilled is certified by AMG after
        inspection.
      </p>
      {message && (
        <p className="mt-4 border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-charcoal">
          {message}
        </p>
      )}
      <div className="mt-6">
        <SupplyKanban requests={requests} onMove={onMove} />
      </div>
    </div>
  );
}
