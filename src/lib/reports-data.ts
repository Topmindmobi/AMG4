import {
  getDemoCategories,
  getDemoOrders,
  getDemoProducts,
  getDemoQuoteRequests,
  getDemoRiderPayouts,
  getDemoRiders,
  getDemoSuppliers,
  getDemoSupplyRequests,
} from "@/lib/store/demo-store";
import type { ReportRange } from "@/lib/reports";
import {
  buildEcommerceOverview,
  buildFinancialReport,
  buildLogisticsReport,
  buildPaymentReport,
  buildProductReport,
  buildQuoteReport,
  buildRiderReport,
  buildSalesReport,
} from "@/lib/reports";
import { isDemoMode } from "@/lib/supabase/config";
import type {
  Category,
  Order,
  Product,
  QuoteRequest,
  Rider,
  RiderPayout,
  Supplier,
  SupplyRequest,
} from "@/lib/types";

async function loadReportDataset() {
  if (isDemoMode()) {
    return {
      orders: getDemoOrders(),
      products: getDemoProducts({ activeOnly: false }),
      categories: getDemoCategories(),
      suppliers: getDemoSuppliers(),
      supplyRequests: getDemoSupplyRequests(),
      quotes: getDemoQuoteRequests(),
      riders: getDemoRiders(),
      payouts: getDemoRiderPayouts(),
    };
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const [orders, products, categories, suppliers, supplyRequests, quotes, riders, payouts] =
    await Promise.all([
      supabase.from("orders").select("*, items:order_items(*)").then((r) => (r.data as Order[]) ?? []),
      supabase
        .from("products")
        .select("*, category:categories(*), supplier:suppliers(*)")
        .then((r) => (r.data as Product[]) ?? []),
      supabase.from("categories").select("*").then((r) => (r.data as Category[]) ?? []),
      supabase.from("suppliers").select("*").then((r) => (r.data as Supplier[]) ?? []),
      supabase.from("supply_requests").select("*").then((r) => (r.data as SupplyRequest[]) ?? []),
      supabase.from("quote_requests").select("*").then((r) => (r.data as QuoteRequest[]) ?? []),
      supabase.from("riders").select("*").then((r) => (r.data as Rider[]) ?? []),
      supabase.from("rider_payouts").select("*").then((r) => (r.data as RiderPayout[]) ?? []),
    ]);

  return { orders, products, categories, suppliers, supplyRequests, quotes, riders, payouts };
}

export async function getOverviewReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildEcommerceOverview(d.orders, d.products, d.supplyRequests, range);
}

export async function getFinancialReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildFinancialReport(d.orders, range);
}

export async function getSalesReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildSalesReport(d.orders, range);
}

export async function getPaymentReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildPaymentReport(d.orders, range);
}

export async function getProductReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildProductReport(d.products, d.orders, d.categories, d.suppliers, range);
}

export async function getLogisticsReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildLogisticsReport(d.orders, d.supplyRequests, range);
}

export async function getQuoteReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildQuoteReport(d.quotes, range);
}

export async function getRiderReport(range?: ReportRange) {
  const d = await loadReportDataset();
  return buildRiderReport(d.riders, d.payouts, d.orders, range);
}
