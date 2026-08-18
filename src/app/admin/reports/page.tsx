"use client";

import { Suspense } from "react";
import {
  money,
  ReportBar,
  ReportFilters,
  ReportSection,
  ReportStackedBar,
  ReportStat,
  ReportTabs,
  ReportTrendChart,
  useReportData,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { ORDER_STATUS_LABELS } from "@/lib/format";
import { getOverviewReport } from "@/lib/reports-data";

function OverviewBody() {
  const range = useReportRange();
  const data = useReportData(getOverviewReport, range);

  if (!data) {
    return <p className="mt-8 text-ink-soft">Loading reports…</p>;
  }

  const maxTown = Math.max(
    ...data.sales.byTown.map((t) => t.amount),
    1,
  );

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

      <ReportSection title="Recognized revenue by day">
        <ReportTrendChart points={data.financial.byDay} />
      </ReportSection>

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
        <ReportStackedBar
          segments={data.payments.rows.map((r) => ({ label: r.label, value: r.amount }))}
        />
        <p className="mt-3 text-xs text-ink-soft">
          {data.payments.payNow.orders} order(s) paid online (
          {data.payments.payNow.share.toFixed(0)}%) — {money(data.payments.payNow.discountIssued)} in
          pay-now discounts issued.
        </p>
      </ReportSection>

      <ReportSection title="Order pipeline">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.logistics.pipeline).map(([status, count]) => (
            <div
              key={status}
              className="border border-line bg-sand px-3 py-3"
            >
              <p className="text-xs text-ink-soft">
                {ORDER_STATUS_LABELS[status] || status}
              </p>
              <p className="mt-1 font-display text-xl text-charcoal">{count}</p>
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
      <h1 className="font-display text-3xl text-charcoal">Reports</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Financial, sales, product, logistics, and payment analytics for AMG Stores.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports" />
        <OverviewBody />
      </Suspense>
    </div>
  );
}
