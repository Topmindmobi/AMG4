"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import {
  money,
  ReportExportButton,
  ReportFilters,
  ReportSection,
  ReportStat,
  ReportTable,
  useReportRange,
} from "@/components/admin/reports/ReportUI";
import { useAuth } from "@/lib/auth-context";
import { buildSupplierReport } from "@/lib/reports";
import {
  getDemoCategories,
  getDemoOrders,
  getDemoProductsBySupplier,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";

function SupplierReportsBody({ supplierId }: { supplierId: string }) {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof buildSupplierReport> | null>(
    null,
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      setData(
        buildSupplierReport(
          supplierId,
          getDemoProductsBySupplier(supplierId),
          getDemoOrders(),
          getDemoSupplyRequests({ supplierId }),
          getDemoCategories(),
          range,
        ),
      );
    });
  }, [supplierId, range.from, range.to]);

  if (!data) return <p className="mt-8 text-sm text-ink-soft">Loading reports…</p>;

  return (
    <>
      <ReportFilters basePath="/supplier/reports" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportStat label="Active SKUs" value={String(data.activeProducts)} />
        <ReportStat
          label="Inventory value"
          value={money(data.inventoryValue)}
          hint={`${data.stockUnits} units on hand`}
        />
        <ReportStat
          label="Low stock"
          value={String(data.lowStockCount)}
          hint={`≤${data.lowStockThreshold} units`}
        />
        <ReportStat label="Out of stock" value={String(data.outOfStockCount)} />
        <ReportStat
          label="Units sold"
          value={String(data.unitsSold)}
          hint="In selected period"
        />
        <ReportStat
          label="Sales revenue"
          value={money(data.revenue)}
          hint="Your line items in period"
        />
      </div>

      <ReportSection
        title="Sales by product"
        action={
          <ReportExportButton
            filename="supplier-sales-by-product.csv"
            headers={["Product", "Category", "Stock", "Sold", "Revenue (KES)"]}
            rows={data.byProduct.map((p) => [
              p.name,
              p.category,
              p.stock,
              p.sold,
              p.revenue,
            ])}
          />
        }
      >
        <ReportTable
          headers={["Product", "Category", "Stock", "Sold", "Revenue"]}
          rows={data.byProduct.slice(0, 25).map((p) => [
            p.name,
            p.category,
            p.stock,
            p.sold,
            money(p.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection
        title="Top movers"
        action={
          <ReportExportButton
            filename="supplier-movers.csv"
            headers={["Product", "Sold", "Revenue (KES)", "Stock left"]}
            rows={data.movers.map((p) => [p.name, p.sold, p.revenue, p.stock])}
          />
        }
      >
        <ReportTable
          headers={["Product", "Sold", "Revenue", "Stock left"]}
          rows={data.movers.map((p) => [
            p.name,
            p.sold,
            money(p.revenue),
            p.stock,
          ])}
        />
      </ReportSection>

      <ReportSection title="Low stock alerts">
        <ReportTable
          headers={["Product", "Stock left", "Unit price"]}
          rows={data.lowStock.map((p) => [
            p.name,
            p.stock,
            money(p.price_kes),
          ])}
        />
        <p className="mt-3 text-xs text-ink-soft">
          <Link href="/supplier/inventory" className="text-forest hover:underline">
            Open inventory
          </Link>{" "}
          to restock.
        </p>
      </ReportSection>

      <ReportSection
        title="Dead stock (on hand, no sales in period)"
        action={
          <ReportExportButton
            filename="supplier-dead-stock.csv"
            headers={["Product", "Stock", "Inventory value (KES)"]}
            rows={data.deadStock.map((p) => [
              p.name,
              p.stock,
              p.inventoryValue,
            ])}
          />
        }
      >
        <ReportTable
          headers={["Product", "Stock", "Inventory value"]}
          rows={data.deadStock.map((p) => [
            p.name,
            p.stock,
            money(p.inventoryValue),
          ])}
        />
      </ReportSection>

      <ReportSection title="Inventory by category">
        <ReportTable
          headers={[
            "Category",
            "Products",
            "Units",
            "Inventory value",
            "Sold",
            "Revenue",
          ]}
          rows={data.byCategory.map((c) => [
            c.name,
            c.products,
            c.stockUnits,
            money(c.inventoryValue),
            c.unitsSold,
            money(c.revenue),
          ])}
        />
      </ReportSection>

      <ReportSection title="Supply pipeline (period)">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReportStat label="Requests" value={String(data.pipeline.total)} />
          <ReportStat
            label="Pipeline value"
            value={money(data.pipeline.value)}
          />
          <ReportStat
            label="Fulfilled value"
            value={money(data.pipeline.fulfilledValue)}
          />
        </div>
        <ReportTable
          headers={["Status", "Count"]}
          rows={[
            ["New / pending", data.pipeline.pending],
            ["Confirmed", data.pipeline.confirmed],
            ["Dispatched", data.pipeline.dispatched],
            ["Fulfilled", data.pipeline.fulfilled],
            ["Rejected", data.pipeline.rejected],
          ]}
        />
      </ReportSection>

      <ReportSection title="Demand by town">
        <ReportTable
          headers={["Town", "Requests", "Fulfilled", "Value"]}
          rows={data.byTown.map((t) => [
            t.town,
            t.requests,
            t.fulfilled,
            money(t.value),
          ])}
        />
      </ReportSection>
    </>
  );
}

export default function SupplierReportsPage() {
  const { supplierId } = useAuth();

  if (!supplierId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-charcoal">Reports</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Standard inventory, sales, and pipeline reports for your catalogue.
            Export any table as CSV.
          </p>
        </div>
        <Link
          href="/supplier/inventory"
          className="border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5"
        >
          Inventory
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-sm text-ink-soft">Loading…</p>}>
        <SupplierReportsBody supplierId={supplierId} />
      </Suspense>
    </div>
  );
}
