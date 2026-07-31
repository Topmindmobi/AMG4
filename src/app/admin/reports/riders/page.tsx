"use client";

import { Suspense } from "react";
import {
  money,
  ReportExportButton,
  ReportFilters,
  ReportSection,
  ReportStat,
  ReportTable,
  ReportTabs,
  useReportData,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { getRiderReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const data = useReportData(getRiderReport, range);

  if (!data) return <p className="mt-8 text-ink-soft">Loading…</p>;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <ReportStat label="Deliveries completed" value={String(data.totalPayouts)} />
        <ReportStat label="Total paid to riders" value={money(data.totalPaidOut)} />
        <ReportStat
          label="Avg. order-to-delivery time"
          value={data.avgDeliveryHours ? `${data.avgDeliveryHours.toFixed(1)}h` : "—"}
        />
      </div>

      <ReportSection
        title="By rider"
        action={
          <ReportExportButton
            filename="rider-performance.csv"
            headers={["Rider", "Town", "Deliveries", "Earned (KES)"]}
            rows={data.byRider.map((r) => [r.name, r.town ?? "", r.deliveries, r.earned])}
          />
        }
      >
        <ReportTable
          headers={["Rider", "Town", "Deliveries", "Earned"]}
          rows={data.byRider.map((r) => [r.name, r.town ?? "—", r.deliveries, money(r.earned)])}
        />
      </ReportSection>
    </>
  );
}

export default function RidersReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Riders report</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Delivery performance and payouts per rider.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/riders" />
        <Body />
      </Suspense>
    </div>
  );
}
