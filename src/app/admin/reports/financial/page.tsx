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
import { getFinancialReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof getFinancialReport> | null>(
    null,
  );

  useEffect(() => {
    setData(getFinancialReport(range));
  }, [range.from, range.to]);

  if (!data) return <p className="mt-8 text-sand/50">Loading…</p>;

  const maxDay = Math.max(...data.byDay.map((d) => d.amount), 1);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportStat label="Gross merchandise value" value={money(data.gmv)} />
        <ReportStat
          label="Recognized revenue"
          value={money(data.recognizedRevenue)}
          hint="Confirmed / in progress / delivered"
        />
        <ReportStat
          label="Delivered revenue"
          value={money(data.deliveredRevenue)}
        />
        <ReportStat label="Average order value" value={money(data.aov)} />
        <ReportStat
          label="Cancelled order value"
          value={money(data.cancelledValue)}
          hint={`${data.cancelledOrders} cancelled`}
        />
        <ReportStat
          label="Orders in period"
          value={String(data.orderCount)}
          hint={`${data.activeOrders} active`}
        />
      </div>

      <ReportSection title="Revenue by day">
        <div className="space-y-3">
          {data.byDay.map((d) => (
            <ReportBar
              key={d.date}
              label={d.date}
              value={d.amount}
              max={maxDay}
              display={money(d.amount)}
            />
          ))}
          {data.byDay.length === 0 && (
            <p className="text-sm text-sand/50">No recognized revenue in range.</p>
          )}
        </div>
      </ReportSection>

      <ReportSection title="Summary table">
        <ReportTable
          headers={["Metric", "Value"]}
          rows={[
            ["GMV", money(data.gmv)],
            ["Recognized revenue", money(data.recognizedRevenue)],
            ["Delivered revenue", money(data.deliveredRevenue)],
            ["Cancelled value", money(data.cancelledValue)],
            ["AOV", money(data.aov)],
            ["Active orders", data.activeOrders],
            ["Cancelled orders", data.cancelledOrders],
          ]}
        />
      </ReportSection>
    </>
  );
}

export default function FinancialReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Financial report</h1>
      <p className="mt-2 text-sm text-sand/55">
        GMV, recognized revenue, AOV, and cancellations.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/financial" />
        <Body />
      </Suspense>
    </div>
  );
}
