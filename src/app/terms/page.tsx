import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — AMG Store",
  description:
    "Terms of Use for the AMG Store marketplace serving customers nationwide across Kenya — accounts, orders, pricing in KES, delivery, and liability.",
};

const lastUpdated = "29 July 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-ember">
        Legal
      </p>
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">
        Terms of Use
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
        These Terms of Use (“Terms”) govern your access to and use of the marketplace operated by{" "}
        <strong className="font-semibold text-charcoal">AMG Store</strong> (“we”, “us”, or “our”),
        including browsing, creating an account, placing orders, and arranging delivery
        nationwide across Kenya. By using the site, you agree to these Terms.
      </p>
      <p className="mt-2 text-[15px] text-ink-soft">Last updated: {lastUpdated}</p>

      <div className="mt-10 space-y-10 text-[16.5px] leading-relaxed text-ink-soft">
        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">1. About the marketplace</h2>
          <p>
            AMG Store provides an online marketplace that connects customers with pilot shops and
            suppliers. Product listings, stock, and fulfilment may involve third-party shops. Where
            we act as an intermediary, the seller remains responsible for product quality and
            description unless we expressly state otherwise at checkout.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">2. Eligibility and accounts</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You must be able to enter a binding contract under the laws of Kenya to place orders.
            </li>
            <li>
              You are responsible for keeping your login credentials confidential and for activity
              under your account.
            </li>
            <li>
              Provide accurate contact and delivery details so riders and shops can fulfil your
              order.
            </li>
            <li>
              We may suspend or terminate accounts that abuse the platform, provide false
              information, or breach these Terms.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">3. Orders</h2>
          <p>
            Placing an order constitutes an offer to purchase the listed items. An order is accepted
            when we (or the fulfilling shop) confirm it, subject to stock and delivery availability.
            We may cancel or refuse orders that appear fraudulent, cannot be delivered to your area,
            or contain pricing or catalogue errors.
          </p>
          <p>
            You will typically receive order status updates through the site (for example under{" "}
            <Link href="/account/orders" className="font-semibold text-forest hover:text-forest-deep">
              My orders
            </Link>
            ) and may also be contacted by phone or WhatsApp using the number you provide.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">4. Pricing and currency</h2>
          <p>
            Prices are displayed in <span className="font-semibold text-charcoal">Kenyan Shillings (KES)</span>{" "}
            unless otherwise stated. Prices may change without notice for future orders. Delivery
            fees, if any, will be shown before you confirm checkout or communicated when your order
            is confirmed. Taxes or levies required by law may apply where relevant.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">5. Payment — COD and M-Pesa</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-charcoal">Cash on delivery (COD)</span> — pay the
              rider or shop representative when your order arrives, unless we agree another
              arrangement.
            </li>
            <li>
              <span className="font-semibold text-charcoal">M-Pesa</span> — pay using the phone number
              and instructions provided when your order is confirmed. Keep payment confirmation
              details until delivery is complete.
            </li>
          </ul>
          <p>
            Failure to pay for a confirmed order may result in cancellation, refusal of future COD
            orders, or account restrictions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">6. Delivery towns and timing</h2>
          <p>
            We deliver <span className="font-semibold text-charcoal">nationwide</span>, including{" "}
            <span className="font-semibold text-charcoal">Nairobi</span>,{" "}
            <span className="font-semibold text-charcoal">Mombasa</span>,{" "}
            <span className="font-semibold text-charcoal">Kisumu</span>, and{" "}
            <span className="font-semibold text-charcoal">Homa Bay</span>, with motorcycle (boda)
            or courier delivery to estates, landmarks, and shops where riders can safely reach.
            Same-day delivery is a goal when stock and rider capacity allow; it is not a
            guaranteed service level.
          </p>
          <p>
            Delivery times are estimates. Delays may occur due to weather, road conditions, traffic,
            stock issues, or incorrect address details. You agree to be reachable on the phone number
            provided for delivery coordination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">7. Returns, cancellations, and issues</h2>
          <p>
            If an item arrives damaged, incorrect, or missing, contact us promptly via{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>{" "}
            with your order reference and photos where helpful. Remedies may include replacement,
            store credit, or refund of amounts paid, at our reasonable discretion and subject to
            seller policies. Perishable or personalised goods may not be returnable except where
            required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">8. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the site for unlawful, fraudulent, or abusive purposes.</li>
            <li>Interfere with security, scrape the site excessively, or disrupt other users.</li>
            <li>Misrepresent your identity or delivery details.</li>
            <li>Resell marketplace content or data without permission.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">9. Intellectual property</h2>
          <p>
            The AMG Store name, logos, site design, and original content are owned by AMG Store or
            its licensors. Product images and descriptions may belong to suppliers. You may not copy
            or reuse marketplace materials except as needed to use the service personally.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">10. Disclaimer and limitation of liability</h2>
          <p>
            The marketplace is provided on an “as available” basis. To the fullest extent permitted
            by Kenyan law, AMG Store is not liable for indirect, incidental, or consequential losses
            (including lost profits or data) arising from use of the site, delayed delivery, or
            third-party seller conduct. Our total liability for any claim relating to an order is
            limited to the amount you paid for that order through AMG Store, except where liability
            cannot be limited by law (including for death or personal injury caused by negligence, or
            fraud).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">11. Privacy</h2>
          <p>
            How we handle personal information is described in our{" "}
            <Link href="/privacy" className="font-semibold text-forest hover:text-forest-deep">
              Privacy Policy
            </Link>
            , which forms part of your agreement with us when you use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">12. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The “Last updated” date will change when we
            do. Continued use after changes take effect means you accept the revised Terms, except
            where Kenyan law requires a different approach.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">13. Governing law and disputes</h2>
          <p>
            These Terms are governed by the laws of the{" "}
            <span className="font-semibold text-charcoal">Republic of Kenya</span>. Courts in Kenya
            have exclusive jurisdiction over disputes arising from these Terms or your use of the
            marketplace, without prejudice to mandatory consumer protections that apply to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">14. Contact</h2>
          <p>
            Questions about these Terms? Contact AMG Store via{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 rounded-[10px] border border-line bg-sand px-4 py-3 text-[14.5px] leading-relaxed text-ink-soft">
        This page is a practical template for AMG Store’s marketplace and is not formal legal advice.
        Seek qualified Kenyan counsel for a binding commercial agreement.
      </p>

      <div className="mt-8 flex flex-wrap gap-3 text-[15.5px] font-semibold">
        <Link href="/privacy" className="text-forest hover:text-forest-deep">
          Privacy Policy
        </Link>
        <span className="text-line">·</span>
        <Link href="/contact" className="text-forest hover:text-forest-deep">
          Contacts
        </Link>
      </div>
    </div>
  );
}
