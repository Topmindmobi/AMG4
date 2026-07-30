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
import { getPaymentReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof getPaymentReport> | null>(
    null,
  );

  useEffect(() => {
    setData(getPaymentReport(range));
  }, [range.from, range.to]);

  if (!data) return <p className="mt-8 text-sand/50">Loading…</p>;

  const max = Math.max(...data.rows.map((r) => r.amount), 1);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ReportStat label="Orders with payment data" value={String(data.totalOrders)} />
        <ReportStat
          label="Active payment volume"
          value={money(data.totalAmount)}
          hint="Excludes cancelled"
        />
      </div>

      <ReportSection title="Payment type mix">
        <div className="space-y-3">
          {data.rows.map((r) => (
            <ReportBar
              key={r.method}
              label={r.label}
              value={r.amount}
              max={max}
              display={`${money(r.amount)} · ${r.share.toFixed(1)}%`}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Payment breakdown">
        <ReportTable
          headers={[
            "Payment type",
            "Orders",
            "Active orders",
            "Amount",
            "Share",
          ]}
          rows={data.rows.map((r) => [
            r.label,
            r.orders,
            r.activeOrders,
            money(r.amount),
            `${r.share.toFixed(1)}%`,
          ])}
        />
      </ReportSection>
    </>
  );
}

export default function PaymentsReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Payment report</h1>
      <p className="mt-2 text-sm text-sand/55">
        Cash on delivery vs M-Pesa volume and share of sales.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/payments" />
        <Body />
      </Suspense>
    </div>
  );
}
