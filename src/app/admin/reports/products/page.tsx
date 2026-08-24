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
import { getProductReport } from "@/lib/reports-data";

function Body() {
  const range = useReportRange();
  const data = useReportData(getProductReport, range);

  if (!data) return <p className="mt-8 text-ink-soft">Loading…</p>;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportStat label="Catalogue size" value={String(data.totalProducts)} />
        <ReportStat label="Active SKUs" value={String(data.activeProducts)} />
        <ReportStat
          label="Inventory value"
          value={money(data.inventoryValue)}
          hint="Price × stock (active)"
        />
        <ReportStat label="Low stock (≤5)" value={String(data.lowStockCount)} />
        <ReportStat label="Out of stock" value={String(data.outOfStockCount)} />
        <ReportStat
          label="Inactive SKUs"
          value={String(data.inactiveProducts)}
        />
      </div>

      <ReportSection title="Inventory by category">
        <ReportTable
          headers={["Category", "Products", "Units", "Inventory value"]}
          rows={data.byCategory.map((c) => [
            c.name,
            c.products,
            c.stockUnits,
            money(c.inventoryValue),
          ])}
        />
      </ReportSection>

      <ReportSection title="By supplier (admin only)">
        <ReportTable
          headers={["Supplier", "Products", "Stock", "Units sold", "Revenue"]}
          rows={data.bySupplier.map((s) => [
            s.name,
            s.products,
            s.stockUnits,
            s.unitsSold,
            money(s.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection
        title="Product movers"
        action={
          <ReportExportButton
            filename="product-movers.csv"
            headers={["Product", "Stock", "Sold", "Revenue (KES)"]}
            rows={data.movers.map((p) => [p.name, p.stock, p.sold, p.revenue])}
          />
        }
      >
        <ReportTable
          headers={["Product", "Stock", "Sold", "Revenue"]}
          rows={data.movers.map((p) => [
            p.name,
            p.stock,
            p.sold,
            money(p.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection title="Low stock alerts">
        <ReportTable
          headers={["Product", "Stock left"]}
          rows={data.lowStock.map((p) => [p.name, p.stock])}
        />
      </ReportSection>
    </>
  );
}

export default function ProductsReportPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Product report</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Inventory value, category mix, supplier contribution, and stock alerts.
      </p>
      <Suspense fallback={null}>
        <ReportTabs />
        <ReportFilters basePath="/admin/reports/products" />
        <Body />
      </Suspense>
    </div>
  );
}
