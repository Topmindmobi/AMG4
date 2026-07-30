"use client";

import {
  getDemoCategories,
  getDemoOrders,
  getDemoProducts,
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
  buildSalesReport,
} from "@/lib/reports";

export function loadReportDataset() {
  return {
    orders: getDemoOrders(),
    products: getDemoProducts({ activeOnly: false }),
    categories: getDemoCategories(),
    suppliers: getDemoSuppliers(),
    supplyRequests: getDemoSupplyRequests(),
  };
}

export function getOverviewReport(range?: ReportRange) {
  const d = loadReportDataset();
  return buildEcommerceOverview(d.orders, d.products, d.supplyRequests, range);
}

export function getFinancialReport(range?: ReportRange) {
  return buildFinancialReport(loadReportDataset().orders, range);
}

export function getSalesReport(range?: ReportRange) {
  return buildSalesReport(loadReportDataset().orders, range);
}

export function getPaymentReport(range?: ReportRange) {
  return buildPaymentReport(loadReportDataset().orders, range);
}

export function getProductReport(range?: ReportRange) {
  const d = loadReportDataset();
  return buildProductReport(
    d.products,
    d.orders,
    d.categories,
    d.suppliers,
    range,
  );
}

export function getLogisticsReport(range?: ReportRange) {
  const d = loadReportDataset();
  return buildLogisticsReport(d.orders, d.supplyRequests, range);
}
