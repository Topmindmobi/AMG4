/**
 * Mirrors the `products_compute_price()` Postgres trigger
 * (supabase/migrations/039_product_markup.sql) exactly — SQL and JS can't
 * share code, so keep these two in sync if the formula ever changes.
 */
export function computeProductPriceKes(
  supplierPriceKes: number,
  markupType: "percent" | "flat" | null,
  markupValue: number | null,
): number {
  const markup =
    markupType === "percent"
      ? (supplierPriceKes * (markupValue ?? 0)) / 100
      : markupType === "flat"
        ? (markupValue ?? 0)
        : 0;
  return Math.round((supplierPriceKes + markup) * 100) / 100;
}
