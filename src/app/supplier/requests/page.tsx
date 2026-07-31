"use client";

import { useCallback, useEffect, useState } from "react";
import { SupplyKanban } from "@/components/supplier/SupplyKanban";
import { useAuth } from "@/lib/auth-context";
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
    setRequests(getDemoSupplyRequests({ supplierId }));
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
        confirmDemoSupplyRequest(requestId, extras.logistics);
        setMessage("Confirmed with logistics plan — card moved to Confirmed.");
        reload();
        return;
      }
      if (to === "dispatched") {
        if (!extras?.dispatch) throw new Error("Driver and vehicle details required");
        dispatchDemoSupplyRequest(requestId, extras.dispatch);
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
