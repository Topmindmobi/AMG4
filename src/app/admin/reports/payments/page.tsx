"use client";

import { Suspense } from "react";
import {
  money,
  ReportFilters,
  ReportSection,
  ReportStackedBar,
  ReportStat,
  ReportTable,
  ReportTabs,
  useReportData,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { getPaymentReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const data = useReportData(getPaymentReport, range);

  if (!data) return <p className="mt-8 text-ink-soft">Loading…</p>;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat label="Orders with payment data" value={String(data.totalOrders)} />
        <ReportStat
          label="Active payment volume"
          value={money(data.totalAmount)}
          hint="Excludes cancelled"
        />
        <ReportStat
          label="Paid online"
          value={String(data.payNow.orders)}
          hint={`${data.payNow.share.toFixed(0)}% of active orders`}
        />
        <ReportStat
          label="Pay-now discounts issued"
          value={money(data.payNow.discountIssued)}
          hint="5% reward for paying online"
        />
      </div>

      <ReportSection title="Payment type mix">
        <ReportStackedBar segments={data.rows.map((r) => ({ label: r.label, value: r.amount }))} />
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
      <h1 className="font-display text-3xl text-charcoal">Payment report</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Cash on delivery vs M-Pesa volume, share of sales, and pay-now discount cost.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/payments" />
        <Body />
      </Suspense>
    </div>
  );
}
