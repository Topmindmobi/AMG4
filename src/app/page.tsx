import Image from "next/image";
import Link from "next/link";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { HeroRouteMap } from "@/components/shop/HeroRouteMap";
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
      <section className="hero-mesh relative overflow-hidden px-5 pb-10 pt-12">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-9">
          <div className="animate-fade-up min-w-[280px] flex-1">
            <div className="mb-6 inline-flex h-[30px] w-fit items-center justify-center rounded-md bg-white px-2 shadow-[0_1px_2px_rgba(14,26,99,0.12)]">
              <AmgLogo priority className="h-[22px] w-auto" />
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-[#F0A585]">
              Nairobi · Mombasa · Kisumu · Homa Bay
            </p>
            <h1 className="max-w-[17ch] font-display text-[clamp(32px,5vw,48px)] font-semibold leading-[1.1] text-white">
              Shop with us at AMG Online Store
            </h1>
            <p className="mt-[18px] mb-7 text-xl font-bold tracking-wide text-white">
              Affordable <span className="text-[#F0A585]">–</span> Convenient{" "}
              <span className="text-[#F0A585]">–</span> Fast
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center rounded-lg bg-ember px-[22px] py-[13px] text-[17px] font-semibold text-white transition hover:bg-ember-deep"
              >
                Shop now
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center rounded-lg border-[1.5px] border-white/50 px-[22px] py-[13px] text-[17px] font-semibold text-white transition hover:bg-white/10"
              >
                Delivering near you
              </Link>
            </div>
          </div>
          <div className="animate-fade-up-delay min-w-[300px] flex-1">
            <HeroRouteMap />
          </div>
        </div>
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
