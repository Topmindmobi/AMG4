"use client";

import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";
import { useState } from "react";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      disabled={product.stock < 1}
      onClick={() => {
        addItem(product);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
      className="inline-flex items-center justify-center rounded-lg bg-ember px-[22px] py-[13px] text-[15px] font-semibold text-white transition hover:bg-ember-deep disabled:cursor-not-allowed disabled:opacity-50"
    >
      {product.stock < 1 ? "Out of stock" : added ? "Added" : "Add to cart"}
    </button>
  );
}
