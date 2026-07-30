"use client";

import { Suspense, useEffect, useState } from "react";
import {
  money,
  ReportBar,
  ReportFilters,
  ReportSection,
  ReportStat,
  ReportTabs,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { ORDER_STATUS_LABELS } from "@/lib/format";
import { getOverviewReport } from "@/lib/reports-data";

function OverviewBody() {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof getOverviewReport> | null>(
    null,
  );

  useEffect(() => {
    setData(getOverviewReport(range));
  }, [range.from, range.to]);

  if (!data) {
    return <p className="mt-8 text-sand/50">Loading reports…</p>;
  }

  const maxTown = Math.max(
    ...data.sales.byTown.map((t) => t.amount),
    1,
  );
  const maxPay = Math.max(...data.payments.rows.map((r) => r.amount), 1);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat
          label="GMV (active)"
          value={money(data.financial.gmv)}
          hint={`${data.financial.activeOrders} active orders`}
        />
        <ReportStat
          label="Recognized revenue"
          value={money(data.financial.recognizedRevenue)}
          hint="Excludes cancelled"
        />
        <ReportStat
          label="Average order value"
          value={money(data.financial.aov)}
        />
        <ReportStat
          label="Fulfillment rate"
          value={`${data.logistics.fulfillmentRate.toFixed(0)}%`}
          hint={`${data.logistics.pipeline.delivered} delivered`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <ReportStat label="Active products" value={String(data.activeProducts)} />
        <ReportStat label="Low stock SKUs" value={String(data.lowStock)} />
        <ReportStat
          label="In transit value"
          value={money(data.logistics.inTransitValue)}
        />
      </div>

      <ReportSection title="Sales by town">
        <div className="space-y-3">
          {data.sales.byTown.map((t) => (
            <ReportBar
              key={t.town}
              label={t.town}
              value={t.amount}
              max={maxTown}
              display={`${money(t.amount)} · ${t.count} orders`}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Payment mix">
        <div className="space-y-3">
          {data.payments.rows.map((r) => (
            <ReportBar
              key={r.method}
              label={r.label}
              value={r.amount}
              max={maxPay}
              display={`${money(r.amount)} · ${r.share.toFixed(0)}%`}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Order pipeline">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.logistics.pipeline).map(([status, count]) => (
            <div
              key={status}
              className="border border-white/10 bg-black/20 px-3 py-3"
            >
              <p className="text-xs text-sand/45">
                {ORDER_STATUS_LABELS[status] || status}
              </p>
              <p className="mt-1 font-display text-xl text-sand">{count}</p>
            </div>
          ))}
        </div>
      </ReportSection>
    </>
  );
}

export default function ReportsOverviewPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Reports</h1>
      <p className="mt-2 text-sm text-sand/55">
        Financial, sales, product, logistics, and payment analytics for AMG.COM.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports" />
        <OverviewBody />
      </Suspense>
    </div>
  );
}
