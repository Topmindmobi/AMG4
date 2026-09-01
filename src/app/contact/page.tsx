import type { Metadata } from "next";
import { ContactForm } from "@/components/shop/ContactForm";

export const metadata: Metadata = {
  title: "Contacts — AMG Online Store",
  description:
    "Get in touch with AMG Online Store for orders, delivery questions, or supplier inquiries anywhere in Kenya — Nairobi, Mombasa, Kisumu, Homa Bay and beyond.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">Contacts</h1>
      <p className="mt-2 text-[16.5px] text-ink-soft">
        Questions about an order, delivery towns, or joining as a supplier? Reach the AMG team
        serving customers nationwide.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[10px] border border-line bg-sand px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ember">Phone / WhatsApp</p>
          <a
            href="tel:+254181347443"
            className="mt-1.5 block text-[17px] font-semibold text-forest hover:text-forest-deep"
          >
            +254 181 347 443
          </a>
          <a
            href="tel:+254181347444"
            className="mt-1 block text-[17px] font-semibold text-forest hover:text-forest-deep"
          >
            +254 181 347 444
          </a>
          <p className="mt-1 text-[14.5px] text-ink-soft">Mon–Sat, 8am–6pm EAT</p>
        </div>
        <div className="rounded-[10px] border border-line bg-sand px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ember">Email</p>
          <a
            href="mailto:hello@amgstores.ai"
            className="mt-1.5 block text-[17px] font-semibold text-forest hover:text-forest-deep"
          >
            hello@amgstores.ai
          </a>
          <p className="mt-1 text-[14.5px] text-ink-soft">Orders &amp; supplier inquiries</p>
        </div>
        <div className="rounded-[10px] border border-line bg-sand px-4 py-4 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ember">Our coverage</p>
          <p className="mt-1.5 text-[16.5px] leading-relaxed text-charcoal">
            Nairobi · Mombasa · Kisumu · Homa Bay — and everywhere in between
          </p>
          <p className="mt-1 text-[14.5px] text-ink-soft">
            Motorcycle and courier delivery to estates and landmarks all across the country.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-[24px] text-charcoal">Send a message</h2>
        <p className="mt-1.5 text-[16.5px] text-ink-soft">
          Tell us how we can help — we&apos;ll get back as soon as we can.
        </p>
        <ContactForm />
      </section>
    </div>
  );
}
