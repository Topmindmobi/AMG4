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
    if (!isDemoMode()) return;
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRequestSupplier(orderId: string, supplierId: string) {
    fulfillOrderWithSupplier(orderId, supplierId);
    setMessage("Supplier request sent.");
    load();
  }

  async function onRecordSupplierResponse(orderId: string) {
    adminRecordSupplierResponse(orderId);
    setMessage("Supplier response recorded.");
    load();
  }

  async function onConfirmBuyer(orderId: string) {
    const order = confirmOrderToBuyer(orderId);
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
    const order = dispatchDemoOrder(orderId, riderId);
    if (order) {
      const riderUserId = getDemoUserIdForRider(riderId);
      if (riderUserId) {
        await notifyRiderDispatchPush({
          userId: riderUserId,
          orderId: order.id,
          town: order.town,
          totalKes: Number(order.total_kes),
          customerName: order.customer_name,
        });
      }
      await notifyOrderStatus({
        orderId,
        event: "dispatched",
        phone: order.phone,
        email: order.email ?? null,
      });
    }
    setMessage("Order out for delivery — rider notified.");
    load();
  }

  async function onDeliver(orderId: string) {
    // Admin override: register payment if rider hasn't yet, then deliver
    const current = getDemoOrders().find((o) => o.id === orderId);
    if (current && !current.paid) {
      markDemoOrderPaid(orderId, { method: current.payment_method || "cod" });
    }
    const { order } = deliverDemoOrder(orderId);
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
