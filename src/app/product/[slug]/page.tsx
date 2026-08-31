import Image from "next/image";
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
import { looksLikeHtml, plainTextToHtml, sanitizeProductHtml } from "@/lib/rich-text";

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
  const detailedHtml = sanitizeProductHtml(
    looksLikeHtml(detailed) ? detailed : plainTextToHtml(detailed),
  );

  return (
    <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-10 lg:grid-cols-2">
      <ProductGallery images={gallery} alt={product.name} />
      <div>
        <Link href="/shop" className="text-sm font-semibold text-forest hover:text-forest-deep">
          ← Back to shop
        </Link>
        <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.06em] text-forest">
          {product.category?.name}
        </p>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,42px)] text-charcoal">
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
        <h2 className="font-display text-[27px] text-charcoal">Product details</h2>
        <div
          className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-ink-soft [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-display [&_h2]:text-xl [&_h3]:font-display [&_h3]:text-lg [&_a]:text-forest [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: detailedHtml }}
        />
        {gallery.length > 1 && (
          <div className="mt-10">
            <h3 className="font-display text-xl text-charcoal">Photo gallery</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line"
                >
                  <Image
                    src={src}
                    alt={`${product.name} gallery ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
