"use client";

import { RIDER_DELIVERY_STATUS_LABELS, RIDER_VEHICLE_LABELS } from "@/lib/format";
import { normalizeRiderDeliveryStatus } from "@/lib/store/demo-store";
import type { Order, RiderDeliveryStatus } from "@/lib/types";

const STAGE_ORDER = [
  "assigned",
  "collected",
  "in_transit",
  "delivered",
  "paid",
] as const satisfies readonly RiderDeliveryStatus[];

const STAGE_LABELS: Record<(typeof STAGE_ORDER)[number], string> = {
  assigned: "Assigned",
  collected: "Collected",
  in_transit: "In transit",
  delivered: "Delivered",
  paid: "Paid",
};

function stageCopy(
  status: RiderDeliveryStatus,
  riderName: string | null | undefined,
  audience: "customer" | "admin",
): string {
  const rider = riderName?.trim() || "AMG rider";
  switch (status) {
    case "assigned":
      return audience === "admin"
        ? `${rider} is assigned to this delivery.`
        : `${rider} has been assigned to deliver your order.`;
    case "collected":
      return audience === "admin"
        ? `${rider} collected goods from the AMG hub.`
        : `${rider} collected your order from the AMG hub and is preparing to leave.`;
    case "in_transit":
      return audience === "admin"
        ? `${rider} is in transit to the customer.`
        : `${rider} is on the way to you.`;
    case "delivered":
      return audience === "admin"
        ? `${rider} handed over the goods — payment may still be pending.`
        : `${rider} has handed over your goods. Complete payment if still unpaid.`;
    case "paid":
      return audience === "admin"
        ? `Payment registered — trip closed by ${rider}.`
        : `Payment received. Delivery complete — thank you.`;
    case "failed":
      return audience === "admin"
        ? `${rider} marked fail delivery.`
        : `${rider} could not complete delivery. AMG will follow up.`;
    default:
      return RIDER_DELIVERY_STATUS_LABELS[status] ?? status;
  }
}

export function RiderDeliveryTracker({
  order,
  audience = "customer",
}: {
  order: Order;
  audience?: "customer" | "admin";
}) {
  const stage = normalizeRiderDeliveryStatus(order);
  const events = order.rider_delivery_events ?? [];
  const hasRider = Boolean(order.rider_id || order.rider_name_snapshot);

  if (!hasRider) return null;

  const failed = stage === "failed";
  const activeIndex = failed
    ? -1
    : Math.max(0, STAGE_ORDER.indexOf(stage === "paid" ? "paid" : stage));

  return (
    <section
      className={
        audience === "admin"
          ? "mt-3 rounded-lg border border-line bg-sand px-3 py-3"
          : "mt-6 rounded-lg border border-line bg-sand px-4 py-4"
      }
    >
      <p
        className={
          audience === "admin"
            ? "text-[13px] font-semibold uppercase tracking-wide text-ink-soft"
            : "text-xs font-bold uppercase tracking-[0.09em] text-ember"
        }
      >
        Rider delivery updates
      </p>
      <p className="mt-1 text-sm text-charcoal">
        Rider:{" "}
        <span className="font-semibold">
          {order.rider_name_snapshot || "Assigned rider"}
        </span>
        {order.rider_vehicle_snapshot && (
          <span className="text-ink-soft">
            {" "}
            · {RIDER_VEHICLE_LABELS[order.rider_vehicle_snapshot] ?? order.rider_vehicle_snapshot}
          </span>
        )}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {stageCopy(stage, order.rider_name_snapshot, audience)}
      </p>

      {!failed && (
        <ol
          className={
            audience === "admin"
              ? "mt-3 grid grid-cols-5 gap-1"
              : "mt-4 grid grid-cols-5 gap-1"
          }
        >
          {STAGE_ORDER.map((id, i) => {
            const done = i <= activeIndex;
            return (
              <li key={id} className="flex flex-col items-center text-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                    done ? "bg-forest text-white" : "bg-line text-ink-soft"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <p
                  className={`mt-1 text-[12px] font-semibold leading-tight ${
                    done ? "text-forest-deep" : "text-ink-soft"
                  }`}
                >
                  {STAGE_LABELS[id]}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {failed && (
        <p className="mt-3 border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ember">
          Fail delivery
          {order.rider_fail_reason ? `: ${order.rider_fail_reason}` : ""}
        </p>
      )}

      {events.length > 0 && (
        <ul
          className={
            audience === "admin"
              ? "mt-3 max-h-32 space-y-1.5 overflow-y-auto border-t border-line pt-2"
              : "mt-4 space-y-2 border-t border-line pt-3"
          }
        >
          {[...events].reverse().map((ev, i) => (
            <li key={`${ev.at}-${i}`} className="text-xs text-ink-soft">
              <span className="font-medium text-charcoal">
                {ev.status === "failed"
                  ? "Fail delivery"
                  : STAGE_LABELS[ev.status as (typeof STAGE_ORDER)[number]] ??
                    RIDER_DELIVERY_STATUS_LABELS[ev.status] ??
                    ev.status}
              </span>
              {" · "}
              {new Date(ev.at).toLocaleString()}
              {ev.note ? ` — ${ev.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
