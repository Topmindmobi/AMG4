"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChoiceDialog,
  ChoicePrimaryButton,
  ChoiceSecondaryButton,
} from "@/components/shop/ChoiceDialog";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [promptOpen, setPromptOpen] = useState(false);

  if (user?.role === "supplier" || user?.role === "rider") {
    return (
      <p className="rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
        Supplier and rider accounts can&apos;t place orders. Register a separate customer
        account to shop.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={product.stock < 1}
        onClick={() => {
          addItem(product);
          setPromptOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-lg bg-ember px-[22px] py-[13px] text-[17px] font-semibold text-white transition hover:bg-ember-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {product.stock < 1 ? "Out of stock" : "Add to cart"}
      </button>

      <ChoiceDialog
        open={promptOpen}
        title="Added to cart"
        description={
          user
            ? `${product.name} is in your cart. View your cart, or continue shopping.`
            : `${product.name} is in your cart. Continue shopping, or go to checkout now.`
        }
        onClose={() => setPromptOpen(false)}
      >
        {user ? (
          <>
            <ChoicePrimaryButton
              onClick={() => {
                setPromptOpen(false);
                router.push("/cart");
              }}
            >
              View cart
            </ChoicePrimaryButton>
            <ChoiceSecondaryButton onClick={() => setPromptOpen(false)}>
              Continue shopping
            </ChoiceSecondaryButton>
          </>
        ) : (
          <>
            <ChoicePrimaryButton
              onClick={() => {
                setPromptOpen(false);
                router.push("/checkout");
              }}
            >
              Checkout
            </ChoicePrimaryButton>
            <ChoiceSecondaryButton onClick={() => setPromptOpen(false)}>
              Continue shopping
            </ChoiceSecondaryButton>
          </>
        )}
      </ChoiceDialog>
    </>
  );
}
