import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — AMG Stores",
  description:
    "AMG Stores is Kenya's nationwide marketplace — electronics, farm supplies, hardware, and home essentials delivered from Nairobi to Mombasa, Kisumu to Homa Bay.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-ember">
        Nairobi · Mombasa · Kisumu · Homa Bay
      </p>
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">About AMG Stores</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
        AMG Stores is Kenya&apos;s nationwide marketplace. We connect partner shops across the
        country — from Nairobi, Mombasa, and Kisumu to Homa Bay, Mbita, and Migori — with
        customers who need electronics, farm supplies, hardware, school books, and everyday
        essentials — delivered by motorcycle the same day when possible.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-[24px] text-charcoal">How it works</h2>
        <ul className="space-y-3 text-[16.5px] leading-relaxed text-ink-soft">
          <li>
            <span className="font-semibold text-charcoal">Browse &amp; order</span> — shop online
            from stores serving towns and cities across the country.
          </li>
          <li>
            <span className="font-semibold text-charcoal">Pay your way</span> — cash on delivery or
            M-Pesa when your order is confirmed.
          </li>
          <li>
            <span className="font-semibold text-charcoal">Boda delivery</span> — motorcycle riders
            bring orders to your estate, landmark, or shop.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-[10px] border border-line bg-sand px-5 py-6">
        <h2 className="font-display text-[24px] text-charcoal">Our focus</h2>
        <p className="mt-2 text-[16.5px] leading-relaxed text-ink-soft">
          We&apos;re growing a nationwide network of partner shops so quality and delivery stay
          reliable. As more suppliers join across the country, the catalog grows — without losing
          the local, personal feel of shopping with people you trust.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/shop"
          className="inline-flex items-center rounded-lg bg-ember px-[22px] py-[13px] text-[17px] font-semibold text-white transition hover:bg-ember-deep"
        >
          Shop now
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center rounded-lg border-[1.5px] border-forest px-[22px] py-[13px] text-[17px] font-semibold text-forest transition hover:bg-sand"
        >
          Contacts
        </Link>
      </div>
    </div>
  );
}
