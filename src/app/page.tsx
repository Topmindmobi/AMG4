import Link from "next/link";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import { HeroRouteMap } from "@/components/shop/HeroRouteMap";
import { PayNowPromo } from "@/components/shop/PayNowPromo";
import { ProductCard } from "@/components/shop/ProductCard";
import { TrustStrip } from "@/components/shop/TrustStrip";
import { listProducts, listTopCategories } from "@/lib/data/catalog";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    listTopCategories(),
    listProducts(),
  ]);
  const featured = products.slice(0, 6);

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
              Order today, the boda&apos;s already warming up.
            </h1>
            <p className="mt-[18px] mb-7 max-w-[46ch] text-base leading-relaxed text-[#C7CCEC]">
              Electronics, farm supplies, hardware, and home essentials delivered nationwide —
              from Nairobi to Mombasa, Kisumu to Homa Bay — pay cash or M-Pesa on arrival.
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

      <TrustStrip />
      <PayNowPromo />

      <section className="px-5 py-[46px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-[26px]">
            <h2 className="font-display text-[27px] text-charcoal">Shop by category</h2>
            <p className="mt-1.5 text-[16.5px] text-ink-soft">
              Everything from phones and printers to cement, eggs, and school books.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className="cat-card-hover flex flex-col gap-2.5 rounded-[10px] border border-line bg-sand px-3.5 py-4"
              >
                <CategoryIcon slug={cat.slug} />
                <span className="text-[15.5px] font-semibold leading-snug text-charcoal">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
