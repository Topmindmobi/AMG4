import Link from "next/link";
import { PAY_NOW_DISCOUNT_RATE } from "@/lib/format";

export function PayNowPromo() {
  const pct = Math.round(PAY_NOW_DISCOUNT_RATE * 100);
  return (
    <section className="px-5 py-4">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-forest px-6 py-5 text-sand-light">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember text-lg font-bold text-white">
              −{pct}%
            </div>
            <div>
              <p className="font-display text-[21px] font-semibold text-white">
                Pay online with M-Pesa — save {pct}% instantly
              </p>
              <p className="mt-0.5 text-[15.5px] text-sand-light/80">
                Confirm payment at checkout and we automatically knock {pct}% off your total.
                Prefer to pay later? Cash on delivery is always available too.
              </p>
            </div>
          </div>
          <Link
            href="/shop"
            className="whitespace-nowrap rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ember-deep"
          >
            Shop &amp; save
          </Link>
        </div>
      </div>
    </section>
  );
}
