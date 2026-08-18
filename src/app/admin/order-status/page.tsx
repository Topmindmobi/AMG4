"use client";

import { useCallback, useEffect, useState } from "react";
import { OrderStatusKanban } from "@/components/admin/OrderStatusKanban";
import { useAuth } from "@/lib/auth-context";
import { notifyOrderStatus } from "@/lib/notifications/notify-client";
import { notifyRiderDispatchPush } from "@/lib/push/subscribe-client";
import { isDemoMode } from "@/lib/supabase/config";
import {
  adminRecordSupplierResponse,
  confirmOrderToBuyer,
  deliverDemoOrder,
  dispatchDemoOrder,
  fulfillOrderWithSupplier,
  getDemoOrders,
  getDemoRiders,
  getDemoServiceRatings,
  getDemoSuppliers,
  getDemoSupplyRequests,
  getDemoUserIdForRider,
  markDemoOrderPaid,
  upsertDemoServiceRating,
} from "@/lib/store/demo-store";
import type {
  Order,
  RatingScores,
  RatingSubject,
  Rider,
  ServiceRating,
  Supplier,
  SupplyRequest,
} from "@/lib/types";

export default function AdminOrderStatusPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplyByOrder, setSupplyByOrder] = useState<Record<string, SupplyRequest[]>>(
    {},
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [ratings, setRatings] = useState<ServiceRating[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (isDemoMode()) {
      const list = getDemoOrders();
      setOrders(list);
      setSuppliers(getDemoSuppliers());
      setRiders(getDemoRiders());
      setRatings(getDemoServiceRatings());
      const map: Record<string, SupplyRequest[]> = {};
      for (const o of list) {
        map[o.id] = getDemoSupplyRequests({ orderId: o.id });
      }
      setSupplyByOrder(map);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: ordersData }, { data: suppliersData }, { data: ridersData }, { data: supplyData }] =
        await Promise.all([
          supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .order("created_at", { ascending: false }),
          supabase.from("suppliers").select("*"),
          supabase.from("riders").select("*").eq("active", true).order("name"),
          supabase.from("supply_requests").select("*"),
        ]);
      setOrders((ordersData as Order[]) ?? []);
      setSuppliers((suppliersData as Supplier[]) ?? []);
      setRiders((ridersData as Rider[]) ?? []);
      const map: Record<string, SupplyRequest[]> = {};
      for (const r of (supplyData as SupplyRequest[]) ?? []) {
        (map[r.order_id] ??= []).push(r);
      }
      setSupplyByOrder(map);
      // No production table backs service ratings yet — leave empty.
      setRatings([]);
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRequestSupplier(orderId: string, supplierId: string) {
    if (isDemoMode()) {
      fulfillOrderWithSupplier(orderId, supplierId);
    } else {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_request_supplier", {
        p_order_id: orderId,
        p_supplier_id: supplierId,
      });
      if (error) throw error;
    }
    setMessage("Supplier request sent.");
    load();
  }

  async function onRecordSupplierResponse(orderId: string) {
    if (isDemoMode()) {
      adminRecordSupplierResponse(orderId);
    } else {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_record_supplier_response", {
        p_order_id: orderId,
      });
      if (error) throw error;
    }
    setMessage("Supplier response recorded.");
    load();
  }

  async function onConfirmBuyer(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (isDemoMode()) {
      confirmOrderToBuyer(orderId);
    } else {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: "confirmed", buyer_notified_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    }
    await notifyOrderStatus({
      orderId,
      event: "confirmed",
      phone: order.phone,
      email: order.email ?? null,
    });
    setMessage("Buyer notified — order confirmed.");
    load();
  }

  async function onDispatch(orderId: string, riderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (isDemoMode()) {
      dispatchDemoOrder(orderId, riderId);
      const riderUserId = getDemoUserIdForRider(riderId);
      if (riderUserId) {
        await notifyRiderDispatchPush({
          userId: riderUserId,
          orderId,
          town: order.town,
          totalKes: Number(order.total_kes),
          customerName: order.customer_name,
        });
      }
    } else {
      const rider = riders.find((r) => r.id === riderId);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({
          status: "out_for_delivery",
          rider_id: riderId,
          rider_name_snapshot: rider?.name ?? null,
          rider_vehicle_snapshot: rider?.vehicle ?? null,
        })
        .eq("id", orderId);
      if (error) throw error;
    }
    await notifyOrderStatus({
      orderId,
      event: "dispatched",
      phone: order.phone,
      email: order.email ?? null,
    });
    setMessage("Order out for delivery — rider notified.");
    load();
  }

  async function onDeliver(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (isDemoMode()) {
      // Admin override: register payment if rider hasn't yet, then deliver
      const current = getDemoOrders().find((o) => o.id === orderId);
      if (current && !current.paid) {
        markDemoOrderPaid(orderId, { method: current.payment_method || "cod" });
      }
      deliverDemoOrder(orderId);
    } else {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      if (!order.paid) {
        const { error: paidError } = await supabase.rpc("rider_mark_order_paid", {
          p_order_id: orderId,
          p_method: order.payment_method || "cod",
        });
        if (paidError) throw paidError;
      }
      const { error } = await supabase.rpc("set_rider_delivery_status", {
        p_order_id: orderId,
        p_to: "delivered",
      });
      if (error) throw error;
    }
    await notifyOrderStatus({
      orderId,
      event: "delivered",
      phone: order.phone,
      email: order.email ?? null,
    });
    setMessage("Order marked delivered — please rate quality.");
    load();
  }

  async function onSaveRatings(
    orderId: string,
    subjects: {
      subject: RatingSubject;
      scores: RatingScores;
      notes: string | null;
    }[],
  ) {
    if (!isDemoMode()) {
      setMessage("Service ratings aren't available in production yet.");
      return;
    }
    const order = getDemoOrders().find((o) => o.id === orderId);
    const srs = getDemoSupplyRequests({ orderId });
    const supplier = srs[0];
    for (const row of subjects) {
      upsertDemoServiceRating({
        order_id: orderId,
        subject: row.subject,
        scores: row.scores,
        notes: row.notes,
        supplier_id: supplier?.supplier_id ?? null,
        supplier_name: supplier?.supplier_name ?? null,
        rider_id: order?.rider_id ?? null,
        rider_name: order?.rider_name_snapshot ?? null,
        created_by: user?.id ?? null,
      });
    }
    setMessage("Ratings saved.");
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Order Status</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Drag orders across the pipeline: Orders → Supplier Request → Supplier
        Response → Orders confirmed → Out on delivery → Delivered. After delivery,
        rate speed, turnaround, quality of service, and quality of goods for
        deliveries, supplier responses, supplier deliveries, goods, and riders.
      </p>
      {message && (
        <p className="mt-4 border border-forest/30 bg-forest/5 px-3 py-2 text-sm text-charcoal">
          {message}
        </p>
      )}
      <div className="mt-8">
        <OrderStatusKanban
          orders={orders}
          supplyByOrder={supplyByOrder}
          suppliers={suppliers}
          riders={riders}
          ratings={ratings}
          onRequestSupplier={onRequestSupplier}
          onRecordSupplierResponse={onRecordSupplierResponse}
          onConfirmBuyer={onConfirmBuyer}
          onDispatch={onDispatch}
          onDeliver={onDeliver}
          onSaveRatings={onSaveRatings}
        />
      </div>
    </div>
  );
}
