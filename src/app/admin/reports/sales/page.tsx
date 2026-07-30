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
import { getSalesReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof getSalesReport> | null>(
    null,
  );

  useEffect(() => {
    setData(getSalesReport(range));
  }, [range.from, range.to]);

  if (!data) return <p className="mt-8 text-sand/50">Loading…</p>;

  const maxStatus = Math.max(...data.byStatus.map((s) => s.amount), 1);
  const maxTown = Math.max(...data.byTown.map((t) => t.amount), 1);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ReportStat label="Sales orders" value={String(data.orders)} />
        <ReportStat label="Sales revenue" value={money(data.revenue)} />
      </div>

      <ReportSection title="By order status">
        <div className="space-y-3">
          {data.byStatus.map((s) => (
            <ReportBar
              key={s.status}
              label={ORDER_STATUS_LABELS[s.status] || s.status}
              value={s.amount}
              max={maxStatus}
              display={`${money(s.amount)} · ${s.count}`}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="By delivery town">
        <div className="space-y-3">
          {data.byTown.map((t) => (
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

      <ReportSection title="Top products">
        <ReportTable
          headers={["Product", "Units sold", "Revenue"]}
          rows={data.topProducts.map((p) => [
            p.name,
            p.qty,
            money(p.revenue),
          ])}
        />
      </ReportSection>
    </>
  );
}

export default function SalesReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Sales report</h1>
      <p className="mt-2 text-sm text-sand/55">
        Orders by status, town performance, and best-selling products.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/sales" />
        <Body />
      </Suspense>
    </div>
  );
}
