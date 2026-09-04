import { productImageUrl } from "@/lib/product-image";
import type { Product } from "@/lib/types";

/** Small square product thumbnail used across the admin lists (dashboard,
 * orders, order status, products) — falls back to a neutral placeholder
 * icon for products with no photo, same icon ProductCard uses storefront-side. */
export function ProductThumb({
  product,
  size = 40,
  className = "",
}: {
  product: Pick<Product, "slug" | "image_path"> | null | undefined;
  size?: number;
  className?: string;
}) {
  const src = product ? productImageUrl(product) : null;

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex shrink-0 items-center justify-center border border-line bg-sand text-line ${className}`}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
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
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className={`shrink-0 border border-line object-cover ${className}`}
    />
  );
}
