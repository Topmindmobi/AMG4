"use client";

import { useRef, useState } from "react";
import { productImageUrl } from "@/lib/product-image";
import type { Product } from "@/lib/types";

const ZOOM_SIZE = 288;

/** Small square product thumbnail — used across admin lists (dashboard,
 * orders, order status, products) and customer-facing order pages. Falls
 * back to a neutral placeholder icon for products with no photo, same icon
 * ProductCard uses storefront-side.
 * With zoomOnHover, shows a larger preview near the cursor's row on hover —
 * positioned via a fixed-position overlay (not a table-relative one) so it
 * always escapes the table's own scroll/clip container. */
export function ProductThumb({
  product,
  size = 40,
  className = "",
  zoomOnHover = false,
}: {
  product: Pick<Product, "slug" | "image_path"> | null | undefined;
  size?: number;
  className?: string;
  zoomOnHover?: boolean;
}) {
  const src = product ? productImageUrl(product) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [zoomPos, setZoomPos] = useState<{ top: number; left: number } | null>(null);

  function onEnter() {
    if (!zoomOnHover || !src) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceRight = window.innerWidth - rect.right;
    const left =
      spaceRight >= ZOOM_SIZE + 16 ? rect.right + 12 : Math.max(8, rect.left - ZOOM_SIZE - 12);
    const top = Math.min(
      Math.max(8, rect.top),
      window.innerHeight - ZOOM_SIZE - 8,
    );
    setZoomPos({ top, left });
  }

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onMouseEnter={onEnter}
      onMouseLeave={() => setZoomPos(null)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: size, height: size }}
          className={`shrink-0 border border-line object-cover ${className}`}
        />
      ) : (
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
      )}

      {zoomPos && src && (
        <div
          className="fixed z-50 border-2 border-line bg-white p-1 shadow-xl"
          style={{ top: zoomPos.top, left: zoomPos.left }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{ width: ZOOM_SIZE, height: ZOOM_SIZE }}
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}
