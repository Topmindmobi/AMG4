import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { getProductBySlug } from "@/lib/data/catalog";
import { formatKes } from "@/lib/format";
import {
  productGalleryUrls,
  productShortDescription,
} from "@/lib/product-image";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const gallery = productGalleryUrls(product);
  const short = productShortDescription(product);
  const detailed =
    product.detailed_description || product.description || short;

  return (
    <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-10 lg:grid-cols-2">
      <ProductGallery images={gallery} alt={product.name} />
      <div>
        <Link href="/shop" className="text-sm font-semibold text-forest hover:text-forest-deep">
          ← Back to shop
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-forest">
          {product.category?.name}
        </p>
        <h1 className="mt-2 font-display text-[clamp(28px,4vw,40px)] text-charcoal">
          {product.name}
        </h1>
        <p className="mt-3 text-2xl font-bold text-ember">
          {formatKes(product.price_kes)}
        </p>
        {short && (
          <p className="mt-4 text-base font-medium leading-relaxed text-ink-soft">
            {short}
          </p>
        )}
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-ink-soft">Stock</dt>
            <dd>{product.stock > 0 ? `${product.stock} available` : "Out of stock"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft">Towns</dt>
            <dd>{product.towns.join(", ")}</dd>
          </div>
          {product.barcode && (
            <div className="flex gap-2">
              <dt className="text-ink-soft">Barcode</dt>
              <dd className="font-mono tracking-wide">{product.barcode}</dd>
            </div>
          )}
        </dl>
        <div className="mt-8">
          <AddToCartButton product={product} />
        </div>
      </div>

      <section className="lg:col-span-2">
        <h2 className="font-display text-[25px] text-charcoal">Product details</h2>
        <div className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-ink-soft whitespace-pre-line">
          {detailed}
        </div>
        {gallery.length > 1 && (
          <div className="mt-10">
            <h3 className="font-display text-xl text-charcoal">Photo gallery</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt={`${product.name} gallery ${i + 1}`}
                  className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
