import Image from "next/image";
import Link from "next/link";
import { PayNowPromo } from "@/components/shop/PayNowPromo";
import { ProductCard } from "@/components/shop/ProductCard";
import { TrustStrip } from "@/components/shop/TrustStrip";
import { listCategories, listProducts } from "@/lib/data/catalog";
import { productImageUrl } from "@/lib/product-image";
import type { Category } from "@/lib/types";

/** Walks category.parent_id up to the top-level (parent_id === null) ancestor. */
function topLevelSlug(category: Category | undefined, byId: Map<string, Category>): string | null {
  let current = category;
  const seen = new Set<string>();
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parent_id);
  }
  return current?.slug ?? null;
}

export default async function HomePage() {
  const [allCategories, products] = await Promise.all([
    listCategories(),
    listProducts(),
  ]);
  const categories = allCategories.filter((c) => !c.parent_id);
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));
  const featured = products.slice(0, 6);

  // One representative product photo per top-level category (walking child
  // categories up to their parent — e.g. a Laptops product represents
  // Electronics), Amazon-style tiles instead of line-icon tiles.
  const categoryImages = new Map<string, string>();
  for (const p of products) {
    const slug = topLevelSlug(p.category, categoryById);
    const image = productImageUrl(p);
    if (slug && image && !categoryImages.has(slug)) {
      categoryImages.set(slug, image);
    }
  }

  return (
    <div>
      <section className="relative overflow-hidden">
        <Link href="/shop" className="block">
          <Image
            src="/hero/amg-hero-banner.jpg"
            alt="AMG Stores — Buy your dreams, it's in your hand. Fast delivery, pay on delivery, trusted store."
            width={1600}
            height={816}
            priority
            className="h-auto w-full"
            sizes="100vw"
          />
        </Link>
      </section>

      <section className="px-5 py-[46px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-[26px]">
            <h2 className="font-display text-[27px] text-charcoal">Shop by category</h2>
            <p className="mt-1.5 text-[16.5px] text-ink-soft">
              Everything from phones and printers to cement, eggs, and school books.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map((cat) => {
              const image = categoryImages.get(cat.slug);
              return (
                <Link
                  key={cat.id}
                  href={`/shop?category=${cat.slug}`}
                  className="cat-card-hover group overflow-hidden rounded-xl border border-line bg-white"
                >
                  <div className="relative aspect-square overflow-hidden bg-sand">
                    {image && (
                      <Image
                        src={image}
                        alt={cat.name}
                        fill
                        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <span className="block px-3 py-2.5 text-[15px] font-semibold leading-snug text-charcoal">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <TrustStrip />
      <PayNowPromo />

      <section className="bg-sand px-5 py-[46px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-[26px] flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[27px] text-charcoal">Featured this week</h2>
              <p className="mt-1.5 text-[16.5px] text-ink-soft">
                Popular picks delivered nationwide.
              </p>
            </div>
            <Link
              href="/shop"
              className="whitespace-nowrap text-[15.5px] font-bold text-forest hover:text-forest-deep"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
