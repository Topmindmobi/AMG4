"use client";

import { Suspense } from "react";
import {
  money,
  ReportFilters,
  ReportSection,
  ReportStat,
  ReportTable,
  ReportTabs,
  useReportData,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { getQuoteReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const data = useReportData(getQuoteReport, range);

  if (!data) return <p className="mt-8 text-ink-soft">Loading…</p>;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat label="Quote requests" value={String(data.total)} />
        <ReportStat
          label="Converted to orders"
          value={String(data.converted)}
          hint={`${data.conversionRate.toFixed(0)}% conversion`}
        />
        <ReportStat
          label="Catalog match rate"
          value={`${data.matchRate.toFixed(0)}%`}
          hint="Items instantly priced"
        />
        <ReportStat label="Potential revenue quoted" value={money(data.potentialRevenue)} />
      </div>

      <ReportSection title="Quote requests by town">
        <ReportTable
          headers={["Town", "Requests", "Quoted value"]}
          rows={data.byTown.map((t) => [t.town, t.count, money(t.amount)])}
        />
      </ReportSection>
    </>
  );
}

export default function QuotesReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Quotes report</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Instant building-materials quotes: volume, catalog match rate, and conversion to orders.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/quotes" />
        <Body />
      </Suspense>
    </div>
  );
}
