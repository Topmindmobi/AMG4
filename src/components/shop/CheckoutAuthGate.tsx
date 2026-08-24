"use client";

import Link from "next/link";
import {
  ChoiceDialog,
  ChoicePrimaryButton,
  ChoiceSecondaryButton,
} from "@/components/shop/ChoiceDialog";

type CheckoutAuthGateProps = {
  open: boolean;
  onCheckoutAsGuest: () => void;
};

/** Shown at checkout when the shopper is not signed in. */
export function CheckoutAuthGate({ open, onCheckoutAsGuest }: CheckoutAuthGateProps) {
  return (
    <ChoiceDialog
      open={open}
      title="How would you like to checkout?"
      description="Sign in to track orders in your account, or continue as a guest. Guests who provide an email get a temporary login so they can monitor their order."
    >
      <ChoicePrimaryButton href="/auth/login?next=/checkout">Log in</ChoicePrimaryButton>
      <ChoiceSecondaryButton onClick={onCheckoutAsGuest}>
        Checkout as guest
      </ChoiceSecondaryButton>
      <Link
        href="/cart"
        className="mt-1 text-center text-sm font-semibold text-ink-soft underline hover:text-forest"
      >
        Back to cart
      </Link>
    </ChoiceDialog>
  );
}
