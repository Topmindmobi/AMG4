import type {
  Category,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  QuoteRequest,
  Rider,
  RiderPayout,
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

  const active = list.filter((o) => o.status !== "cancelled");
  const paidOnline = active.filter((o) => o.paid);
  const discountIssued = sum(paidOnline.map((o) => Number(o.discount_kes || 0)));

  return {
    totalOrders: list.length,
    totalAmount: sum(rows.map((r) => r.amount)),
    rows,
    payNow: {
      orders: paidOnline.length,
      share: active.length ? (paidOnline.length / active.length) * 100 : 0,
      discountIssued,
    },
  };
}

export function buildQuoteReport(quotes: QuoteRequest[], range?: ReportRange) {
  const list = quotes.filter((q) => inRange(q.created_at, range));
  const converted = list.filter((q) => q.status === "converted");
  const totalItems = sum(list.map((q) => q.items.length));
  const unmatchedItems = sum(list.map((q) => q.unmatched_count));

  const byTown = new Map<Town, { count: number; amount: number }>();
  for (const q of list) {
    const row = byTown.get(q.town) || { count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(q.total_kes);
    byTown.set(q.town, row);
  }

  return {
    total: list.length,
    converted: converted.length,
    conversionRate: list.length ? (converted.length / list.length) * 100 : 0,
    potentialRevenue: sum(list.map((q) => Number(q.total_kes))),
    matchRate: totalItems ? ((totalItems - unmatchedItems) / totalItems) * 100 : 100,
    byTown: Array.from(byTown.entries()).map(([town, v]) => ({ town, ...v })),
  };
}

export function buildRiderReport(
  riders: Rider[],
  payouts: RiderPayout[],
  orders: Order[],
  range?: ReportRange,
) {
  const inRangePayouts = payouts.filter((p) => inRange(p.created_at, range));
  const deliveredInRange = orders.filter(
    (o) => o.status === "delivered" && o.delivered_at && inRange(o.delivered_at, range),
  );

  const deliveryTimesMs = deliveredInRange
    .filter((o) => o.delivered_at)
    .map((o) => +new Date(o.delivered_at!) - +new Date(o.created_at));
  const avgDeliveryHours = deliveryTimesMs.length
    ? sum(deliveryTimesMs) / deliveryTimesMs.length / 3_600_000
    : 0;

  const byRider = riders
    .map((r) => {
      const riderPayouts = inRangePayouts.filter((p) => p.rider_id === r.id);
      return {
        id: r.id,
        name: r.name,
        town: r.town,
        vehicle: r.vehicle,
        deliveries: riderPayouts.length,
        earned: sum(riderPayouts.map((p) => Number(p.amount_kes))),
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);

  return {
    totalPayouts: inRangePayouts.length,
    totalPaidOut: sum(inRangePayouts.map((p) => Number(p.amount_kes))),
    avgDeliveryHours,
    byRider,
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
    dispatched: supplyInRange.filter((r) => r.status === "dispatched").length,
    fulfilled: supplyInRange.filter((r) => r.status === "fulfilled").length,
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

const LOW_STOCK_THRESHOLD = 5;

/** Supplier-scoped inventory + sales + pipeline reports. */
export function buildSupplierReport(
  supplierId: string,
  products: Product[],
  orders: Order[],
  supplyRequests: SupplyRequest[],
  categories: Category[],
  range?: ReportRange,
) {
  const mine = products.filter((p) => p.supplier_id === supplierId);
  const active = mine.filter((p) => p.is_active);
  const inactive = mine.filter((p) => !p.is_active);
  const lowStock = active.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
  const outOfStock = active.filter((p) => p.stock === 0);
  const stockUnits = sum(active.map((p) => p.stock));
  const inventoryValue = sum(active.map((p) => p.price_kes * p.stock));

  const orderList = filterOrders(orders, range).filter(
    (o) => o.status !== "cancelled",
  );
  const soldQty = new Map<string, number>();
  const soldRev = new Map<string, number>();
  let unitsSold = 0;
  let revenue = 0;

  for (const o of orderList) {
    for (const item of o.items ?? []) {
      if (item.supplier_id !== supplierId) continue;
      const pid = item.product_id || item.name_snapshot;
      const qty = item.qty;
      const line = item.price_kes * qty;
      soldQty.set(pid, (soldQty.get(pid) || 0) + qty);
      soldRev.set(pid, (soldRev.get(pid) || 0) + line);
      unitsSold += qty;
      revenue += line;
    }
  }

  const byProduct = mine
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      price_kes: p.price_kes,
      inventoryValue: p.price_kes * p.stock,
      is_active: p.is_active,
      sold: soldQty.get(p.id) || 0,
      revenue: soldRev.get(p.id) || 0,
      category: p.category?.name || categories.find((c) => c.id === p.category_id)?.name || "—",
    }))
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);

  const movers = byProduct.filter((p) => p.sold > 0).slice(0, 20);
  const deadStock = active
    .filter((p) => p.stock > 0 && !(soldQty.get(p.id) || 0))
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      inventoryValue: p.price_kes * p.stock,
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .slice(0, 20);

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
        unitsSold: sum(inCat.map((p) => soldQty.get(p.id) || 0)),
        revenue: sum(inCat.map((p) => soldRev.get(p.id) || 0)),
      };
    })
    .filter((r) => r.products > 0)
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  const supplyMine = supplyRequests.filter(
    (r) => r.supplier_id === supplierId && inRange(r.created_at, range),
  );
  const pipeline = {
    pending: supplyMine.filter((r) => r.status === "pending").length,
    confirmed: supplyMine.filter((r) => r.status === "confirmed").length,
    dispatched: supplyMine.filter((r) => r.status === "dispatched").length,
    fulfilled: supplyMine.filter((r) => r.status === "fulfilled").length,
    rejected: supplyMine.filter((r) => r.status === "rejected").length,
    total: supplyMine.length,
    value: sum(
      supplyMine
        .filter((r) => r.status !== "rejected")
        .map((r) => Number(r.total_kes)),
    ),
    fulfilledValue: sum(
      supplyMine
        .filter((r) => r.status === "fulfilled")
        .map((r) => Number(r.total_kes)),
    ),
  };

  const byTownMap = new Map<
    Town,
    { requests: number; value: number; fulfilled: number }
  >();
  for (const r of supplyMine) {
    if (r.status === "rejected") continue;
    const row = byTownMap.get(r.customer_town) || {
      requests: 0,
      value: 0,
      fulfilled: 0,
    };
    row.requests += 1;
    row.value += Number(r.total_kes);
    if (r.status === "fulfilled") row.fulfilled += 1;
    byTownMap.set(r.customer_town, row);
  }
  const byTown = Array.from(byTownMap.entries())
    .map(([town, v]) => ({ town, ...v }))
    .sort((a, b) => b.value - a.value);

  return {
    totalProducts: mine.length,
    activeProducts: active.length,
    inactiveProducts: inactive.length,
    stockUnits,
    inventoryValue,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    lowStock: lowStock
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        price_kes: p.price_kes,
      }))
      .sort((a, b) => a.stock - b.stock),
    unitsSold,
    revenue,
    byProduct,
    movers,
    deadStock,
    byCategory,
    pipeline,
    byTown,
  };
}
