import Link from "next/link";
import { formatKes } from "@/lib/format";
import { productImageUrl, productShortDescription } from "@/lib/product-image";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const image = productImageUrl(product);
  const short = productShortDescription(product);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-xl border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(14,26,99,0.08)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-sand">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-line">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="12" rx="1" />
              <path d="M2 18h20" />
            </svg>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-forest">
          {product.category?.name ?? "AMG"}
        </p>
        <h3 className="mt-1.5 text-[15.5px] font-bold leading-snug text-charcoal group-hover:text-forest">
          {product.name}
        </h3>
        {short && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">{short}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-ember">{formatKes(product.price_kes)}</span>
          <span className="text-[11.5px] text-ink-soft">{product.towns.join(" · ")}</span>
        </div>
      </div>
    </Link>
  );
}
