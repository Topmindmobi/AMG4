import { Suspense } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { listProducts, listTopCategories } from "@/lib/data/catalog";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; town?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const [categories, products] = await Promise.all([
    listTopCategories(),
    listProducts({
      q: sp.q,
      town: sp.town,
      categorySlug: sp.category,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-10">
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">Shop</h1>
      <p className="mt-2 text-[16.5px] text-ink-soft">
        Browse products available for delivery nationwide — Nairobi, Mombasa, Kisumu, Homa Bay
        and beyond.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-sand" />}>
          <ShopFilters categories={categories} />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-ink-soft">{products.length} products</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {products.length === 0 && (
        <p className="mt-12 text-center text-ink-soft">No products match your filters.</p>
      )}
    </div>
  );
}
