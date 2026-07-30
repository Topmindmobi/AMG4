"use client";

import { Suspense, useEffect, useState } from "react";
import {
  money,
  ReportBar,
  ReportFilters,
  ReportSection,
  ReportStat,
  ReportTable,
  ReportTabs,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { ORDER_STATUS_LABELS } from "@/lib/format";
import { getLogisticsReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof getLogisticsReport> | null>(
    null,
  );

  useEffect(() => {
    setData(getLogisticsReport(range));
  }, [range.from, range.to]);

  if (!data) return <p className="mt-8 text-sand/50">Loading…</p>;

  const maxTown = Math.max(...data.byTown.map((t) => t.orders), 1);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat
          label="Fulfillment rate"
          value={`${data.fulfillmentRate.toFixed(1)}%`}
        />
        <ReportStat
          label="Out for delivery"
          value={String(data.pipeline.out_for_delivery)}
        />
        <ReportStat
          label="In-transit value"
          value={money(data.inTransitValue)}
        />
        <ReportStat
          label="Awaiting supplier"
          value={String(data.pipeline.awaiting_supplier)}
        />
      </div>

      <ReportSection title="Delivery towns">
        <div className="space-y-3">
          {data.byTown.map((t) => (
            <ReportBar
              key={t.town}
              label={t.town}
              value={t.orders}
              max={maxTown}
              display={`${t.orders} orders · ${t.delivered} delivered · ${t.inTransit} in transit`}
            />
          ))}
        </div>
        <div className="mt-6">
          <ReportTable
            headers={["Town", "Orders", "Delivered", "In transit", "Amount"]}
            rows={data.byTown.map((t) => [
              t.town,
              t.orders,
              t.delivered,
              t.inTransit,
              money(t.amount),
            ])}
          />
        </div>
      </ReportSection>

      <ReportSection title="Fulfillment pipeline">
        <ReportTable
          headers={["Stage", "Orders"]}
          rows={Object.entries(data.pipeline).map(([status, count]) => [
            ORDER_STATUS_LABELS[status] || status,
            count,
          ])}
        />
      </ReportSection>

      <ReportSection title="Supplier logistics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportStat label="Supply requests" value={String(data.supply.total)} />
          <ReportStat label="Pending with suppliers" value={String(data.supply.pending)} />
          <ReportStat label="Supplier confirmed" value={String(data.supply.confirmed)} />
          <ReportStat label="Supply value" value={money(data.supply.value)} />
        </div>
      </ReportSection>
    </>
  );
}

export default function LogisticsReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Logistics report</h1>
      <p className="mt-2 text-sm text-sand/55">
        Delivery towns, pipeline stages, and supplier fulfillment.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/logistics" />
        <Body />
      </Suspense>
    </div>
  );
}
