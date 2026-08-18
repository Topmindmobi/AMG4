"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatKes } from "@/lib/format";

export default function CartPage() {
  const { items, total, updateQty, removeItem } = useCart();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">Your cart</h1>
        <p className="mt-4 text-ink-soft">Cart is empty.</p>
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-lg bg-ember px-[22px] py-[13px] text-[17px] font-semibold text-white hover:bg-ember-deep"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">Your cart</h1>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_path || `/products/${item.slug}.jpg`}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <Link
                  href={`/product/${item.slug}`}
                  className="text-[17.5px] font-bold hover:text-forest"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm font-bold text-ember">{formatKes(item.price_kes)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateQty(item.productId, Number(e.target.value))}
                className="w-16 rounded-lg border-[1.5px] border-line bg-white px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-sm text-ink-soft hover:text-ember"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg font-bold">Total {formatKes(total)}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="rounded-lg border-[1.5px] border-line bg-white px-[22px] py-[13px] text-[17px] font-semibold text-forest hover:border-forest"
          >
            Continue shopping
          </Link>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="rounded-lg bg-ember px-[22px] py-[13px] text-[17px] font-semibold text-white hover:bg-ember-deep"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
