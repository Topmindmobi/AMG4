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
import { isDemoMode } from "@/lib/supabase/config";
import {
  getDemoCategories,
  getDemoOrders,
  getDemoProductsBySupplier,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";
import type { Category, Order, Product, SupplyRequest } from "@/lib/types";

function SupplierReportsBody({ supplierId }: { supplierId: string }) {
  const range = useReportRange();
  const [data, setData] = useState<ReturnType<typeof buildSupplierReport> | null>(
    null,
  );

  useEffect(() => {
    if (isDemoMode()) {
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
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ data: products }, { data: salesJson }, { data: supplyRequests }, { data: categories }] =
        await Promise.all([
          supabase.from("products").select("*").eq("supplier_id", supplierId),
          // Privacy-scoped RPC — returns only order_created_at/status and
          // this supplier's own line items, never customer PII. See
          // 028_supplier_sales_data.sql.
          supabase.rpc("get_supplier_sales_data"),
          supabase.from("supply_requests").select("*").eq("supplier_id", supplierId),
          supabase.from("categories").select("*").order("sort_order"),
        ]);
      // Reshape the RPC's minimal rows into the same Order[] shape
      // buildSupplierReport already reads (it only ever touches
      // created_at/status at the order level, so every other Order field
      // can simply be absent here).
      const orders = ((salesJson as { created_at: string; status: string; items: unknown[] }[]) ?? []).map(
        (o) => ({ created_at: o.created_at, status: o.status, items: o.items }) as unknown as Order,
      );
      setData(
        buildSupplierReport(
          supplierId,
          (products as Product[]) ?? [],
          orders,
          (supplyRequests as SupplyRequest[]) ?? [],
          (categories as Category[]) ?? [],
          range,
        ),
      );
    })();
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
