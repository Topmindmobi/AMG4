import type {
  Category,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  Supplier,
  SupplyRequest,
  Town,
} from "@/lib/types";

export type ReportRange = {
  from?: string; // ISO date YYYY-MM-DD
  to?: string;
};

const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "out_for_delivery",
  "delivered",
  "supplier_confirmed",
  "awaiting_supplier",
];

export function inRange(iso: string, range?: ReportRange): boolean {
  if (!range?.from && !range?.to) return true;
  const d = iso.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function filterOrders(orders: Order[], range?: ReportRange): Order[] {
  return orders.filter((o) => inRange(o.created_at, range));
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function buildFinancialReport(orders: Order[], range?: ReportRange) {
  const list = filterOrders(orders, range);
  const active = list.filter((o) => o.status !== "cancelled");
  const cancelled = list.filter((o) => o.status === "cancelled");
  const delivered = list.filter((o) => o.status === "delivered");
  const recognized = list.filter((o) => REVENUE_STATUSES.includes(o.status));

  const gmv = sum(active.map((o) => Number(o.total_kes)));
  const recognizedRevenue = sum(recognized.map((o) => Number(o.total_kes)));
  const deliveredRevenue = sum(delivered.map((o) => Number(o.total_kes)));
  const cancelledValue = sum(cancelled.map((o) => Number(o.total_kes)));
  const aov = active.length ? gmv / active.length : 0;

  const byDayMap = new Map<string, number>();
  for (const o of recognized) {
    const day = o.created_at.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) || 0) + Number(o.total_kes));
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    orderCount: list.length,
    activeOrders: active.length,
    cancelledOrders: cancelled.length,
    gmv,
    recognizedRevenue,
    deliveredRevenue,
    cancelledValue,
    aov,
    byDay,
  };
}

export function buildSalesReport(orders: Order[], range?: ReportRange) {
  const list = filterOrders(orders, range).filter((o) => o.status !== "cancelled");

  const byStatus = new Map<OrderStatus, { count: number; amount: number }>();
  const byTown = new Map<Town, { count: number; amount: number }>();
  const productMap = new Map<
    string,
    { name: string; qty: number; revenue: number }
  >();

  for (const o of list) {
    const st = byStatus.get(o.status) || { count: 0, amount: 0 };
    st.count += 1;
    st.amount += Number(o.total_kes);
    byStatus.set(o.status, st);

    const tn = byTown.get(o.town) || { count: 0, amount: 0 };
    tn.count += 1;
    tn.amount += Number(o.total_kes);
    byTown.set(o.town, tn);

    for (const item of o.items ?? []) {
      const key = item.product_id || item.name_snapshot;
      const row = productMap.get(key) || {
        name: item.name_snapshot,
        qty: 0,
        revenue: 0,
      };
      row.qty += item.qty;
      row.revenue += item.price_kes * item.qty;
      productMap.set(key, row);
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    orders: list.length,
    revenue: sum(list.map((o) => Number(o.total_kes))),
    byStatus: Array.from(byStatus.entries()).map(([status, v]) => ({
      status,
      ...v,
    })),
    byTown: Array.from(byTown.entries()).map(([town, v]) => ({ town, ...v })),
    topProducts,
  };
}

export function buildPaymentReport(orders: Order[], range?: ReportRange) {
  const list = filterOrders(orders, range);
  const methods: PaymentMethod[] = ["cod", "mpesa"];
  const rows = methods.map((method) => {
    const subset = list.filter((o) => o.payment_method === method);
    const active = subset.filter((o) => o.status !== "cancelled");
    return {
      method,
      label: method === "cod" ? "Cash on delivery" : "M-Pesa",
      orders: subset.length,
      activeOrders: active.length,
      amount: sum(active.map((o) => Number(o.total_kes))),
      share: 0,
    };
  });
  const total = sum(rows.map((r) => r.amount)) || 1;
  for (const r of rows) r.share = (r.amount / total) * 100;

  return {
    totalOrders: list.length,
    totalAmount: sum(rows.map((r) => r.amount)),
    rows,
  };
}

export function buildProductReport(
  products: Product[],
  orders: Order[],
  categories: Category[],
  suppliers: Supplier[],
  range?: ReportRange,
) {
  const list = filterOrders(orders, range).filter((o) => o.status !== "cancelled");
  const soldQty = new Map<string, number>();
  const soldRev = new Map<string, number>();
  for (const o of list) {
    for (const item of o.items ?? []) {
      if (!item.product_id) continue;
      soldQty.set(
        item.product_id,
        (soldQty.get(item.product_id) || 0) + item.qty,
      );
      soldRev.set(
        item.product_id,
        (soldRev.get(item.product_id) || 0) + item.price_kes * item.qty,
      );
    }
  }

  const active = products.filter((p) => p.is_active);
  const inactive = products.filter((p) => !p.is_active);
  const lowStock = active.filter((p) => p.stock <= 5);
  const outOfStock = active.filter((p) => p.stock === 0);
  const inventoryValue = sum(active.map((p) => p.price_kes * p.stock));

  const byCategory = categories
    .filter((c) => !c.parent_id)
    .map((cat) => {
      const childIds = categories
        .filter((c) => c.parent_id === cat.id)
        .map((c) => c.id);
      const ids = new Set([cat.id, ...childIds]);
      const inCat = active.filter((p) => ids.has(p.category_id));
      return {
        name: cat.name,
        products: inCat.length,
        stockUnits: sum(inCat.map((p) => p.stock)),
        inventoryValue: sum(inCat.map((p) => p.price_kes * p.stock)),
      };
    })
    .filter((r) => r.products > 0)
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  const bySupplier = suppliers
    .map((s) => {
      const inSup = active.filter((p) => p.supplier_id === s.id);
      return {
        name: s.name,
        products: inSup.length,
        stockUnits: sum(inSup.map((p) => p.stock)),
        unitsSold: sum(inSup.map((p) => soldQty.get(p.id) || 0)),
        revenue: sum(inSup.map((p) => soldRev.get(p.id) || 0)),
      };
    })
    .filter((r) => r.products > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const movers = active
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      sold: soldQty.get(p.id) || 0,
      revenue: soldRev.get(p.id) || 0,
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 15);

  return {
    totalProducts: products.length,
    activeProducts: active.length,
    inactiveProducts: inactive.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    inventoryValue,
    byCategory,
    bySupplier,
    movers,
    lowStock: lowStock
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock }))
      .sort((a, b) => a.stock - b.stock),
  };
}

export function buildLogisticsReport(
  orders: Order[],
  supplyRequests: SupplyRequest[],
  range?: ReportRange,
) {
  const list = filterOrders(orders, range);
  const byTown = new Map<
    Town,
    { orders: number; delivered: number; inTransit: number; amount: number }
  >();

  for (const o of list) {
    const row = byTown.get(o.town) || {
      orders: 0,
      delivered: 0,
      inTransit: 0,
      amount: 0,
    };
    row.orders += 1;
    if (o.status === "delivered") row.delivered += 1;
    if (o.status === "out_for_delivery") row.inTransit += 1;
    if (o.status !== "cancelled") row.amount += Number(o.total_kes);
    byTown.set(o.town, row);
  }

  const pipeline = {
    pending: list.filter((o) => o.status === "pending").length,
    awaiting_supplier: list.filter((o) => o.status === "awaiting_supplier")
      .length,
    supplier_confirmed: list.filter((o) => o.status === "supplier_confirmed")
      .length,
    confirmed: list.filter((o) => o.status === "confirmed").length,
    out_for_delivery: list.filter((o) => o.status === "out_for_delivery")
      .length,
    delivered: list.filter((o) => o.status === "delivered").length,
    cancelled: list.filter((o) => o.status === "cancelled").length,
  };

  const supplyInRange = supplyRequests.filter((r) =>
    inRange(r.created_at, range),
  );
  const supply = {
    total: supplyInRange.length,
    pending: supplyInRange.filter((r) => r.status === "pending").length,
    confirmed: supplyInRange.filter((r) => r.status === "confirmed").length,
    rejected: supplyInRange.filter((r) => r.status === "rejected").length,
    value: sum(
      supplyInRange
        .filter((r) => r.status !== "rejected")
        .map((r) => Number(r.total_kes)),
    ),
  };

  const fulfillmentRate =
    list.filter((o) => o.status !== "cancelled").length === 0
      ? 0
      : (pipeline.delivered /
          list.filter((o) => o.status !== "cancelled").length) *
        100;

  return {
    pipeline,
    byTown: Array.from(byTown.entries()).map(([town, v]) => ({ town, ...v })),
    supply,
    fulfillmentRate,
    inTransitValue: sum(
      list
        .filter((o) => o.status === "out_for_delivery")
        .map((o) => Number(o.total_kes)),
    ),
  };
}

export function buildEcommerceOverview(
  orders: Order[],
  products: Product[],
  supplyRequests: SupplyRequest[],
  range?: ReportRange,
) {
  const financial = buildFinancialReport(orders, range);
  const sales = buildSalesReport(orders, range);
  const payments = buildPaymentReport(orders, range);
  const logistics = buildLogisticsReport(orders, supplyRequests, range);
  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStock = products.filter((p) => p.is_active && p.stock <= 5).length;

  return {
    financial,
    sales,
    payments,
    logistics,
    activeProducts,
    lowStock,
  };
}
