import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AMG Store",
  description:
    "How AMG Store collects, uses, and protects personal information for customers shopping across Homabay, Mbita, and Migori.",
};

const lastUpdated = "29 July 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-ember">
        Legal
      </p>
      <h1 className="font-display text-[clamp(28px,4vw,36px)] text-charcoal">
        Privacy Policy
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        This Privacy Policy explains how <strong className="font-semibold text-charcoal">AMG Store</strong>{" "}
        (“we”, “us”, or “our”) collects, uses, stores, and shares personal information when you use
        our marketplace website and related services serving Homabay, Mbita, and Migori, Kenya.
      </p>
      <p className="mt-2 text-[13px] text-ink-soft">Last updated: {lastUpdated}</p>

      <div className="mt-10 space-y-10 text-[14.5px] leading-relaxed text-ink-soft">
        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">1. Who we are</h2>
          <p>
            AMG Store operates a local marketplace connecting customers with pilot shops and
            suppliers. Orders may be fulfilled by motorcycle delivery (boda) and paid by cash on
            delivery (COD) or M-Pesa. For privacy questions, contact us via the details on our{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>{" "}
            page.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">2. Information we collect</h2>
          <p>Depending on how you use the site, we may collect:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-charcoal">Account details</span> — name, email
              address, phone number, and password (or authentication credentials) when you create an
              account or sign in.
            </li>
            <li>
              <span className="font-semibold text-charcoal">Order &amp; delivery details</span> —
              delivery town or area (e.g. Homabay, Mbita, Migori), landmark or address notes, phone
              number for rider contact, items ordered, and order status history.
            </li>
            <li>
              <span className="font-semibold text-charcoal">Payment-related information</span> — payment
              method preference (COD or M-Pesa) and, where you choose M-Pesa, the phone number used
              for payment coordination. We do not store M-Pesa PINs or full payment credentials.
            </li>
            <li>
              <span className="font-semibold text-charcoal">Messages</span> — content you send through
              contact or support forms.
            </li>
            <li>
              <span className="font-semibold text-charcoal">Technical data</span> — browser type,
              device information, IP address, and basic usage logs needed to operate and secure the
              service.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">3. Cookies and local storage</h2>
          <p>
            We use cookies and browser local storage where needed for core site functions, such as
            keeping you signed in, remembering cart contents, and saving preferences. These are
            primarily functional rather than advertising trackers. You can clear cookies and local
            storage through your browser settings; doing so may sign you out or empty your cart.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">4. Authentication and Supabase</h2>
          <p>
            Account sign-up, sign-in, and session management may be provided through{" "}
            <span className="font-semibold text-charcoal">Supabase</span> (or a similar hosted backend)
            acting as our data processor. Authentication data and related account records are stored
            on secure servers operated by us or our service providers. Access is limited to personnel
            and systems that need it to run the marketplace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">5. How we use your information</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Create and manage your account.</li>
            <li>Process, fulfil, and track orders, including coordinating motorcycle delivery.</li>
            <li>Contact you about order status, delivery, payment (COD/M-Pesa), or support.</li>
            <li>Improve the marketplace, prevent fraud, and keep the platform secure.</li>
            <li>Comply with applicable Kenyan law and respond to lawful requests.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">6. Payments (COD and M-Pesa)</h2>
          <p>
            If you select cash on delivery, your phone and delivery details are used so the rider or
            shop can collect payment on arrival. If you select M-Pesa, we may use the phone number you
            provide to coordinate payment instructions with you or our payment partners. M-Pesa
            transactions are processed through Safaricom’s systems; AMG Store does not receive your
            M-Pesa PIN.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">7. Sharing of information</h2>
          <p>We may share personal information with:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Pilot shops and suppliers fulfilling your order.</li>
            <li>Delivery riders or logistics partners serving Homabay, Mbita, and Migori.</li>
            <li>Technology providers (e.g. hosting, authentication, analytics) under appropriate
              agreements.</li>
            <li>Authorities when required by Kenyan law.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">8. Retention and security</h2>
          <p>
            We retain account and order information for as long as needed to provide the service,
            resolve disputes, and meet legal or accounting requirements. We use reasonable technical
            and organisational measures to protect data; no method of transmission or storage is
            completely secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">9. Your choices</h2>
          <p>
            You may request access to, correction of, or deletion of personal information we hold
            about you, subject to legal exceptions (for example, records we must keep for orders).
            Contact us via the{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>{" "}
            page. You may also close your account where that functionality is available.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">10. Children’s privacy</h2>
          <p>
            The marketplace is intended for users who can form a binding contract under Kenyan law.
            We do not knowingly collect personal information from children for commercial accounts
            without appropriate consent from a parent or guardian.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">11. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The “Last updated” date at the top
            will change when we do. Continued use of the site after updates constitutes acceptance of
            the revised policy where permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[22px] text-charcoal">12. Contact</h2>
          <p>
            For privacy requests or questions about this policy, reach AMG Store through{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 rounded-[10px] border border-line bg-sand px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
        This page is a practical template for AMG Store’s marketplace and is not formal legal advice.
        Seek qualified Kenyan counsel if you need a binding privacy opinion.
      </p>

      <div className="mt-8 flex flex-wrap gap-3 text-[13.5px] font-semibold">
        <Link href="/terms" className="text-forest hover:text-forest-deep">
          Terms of Use
        </Link>
        <span className="text-line">·</span>
        <Link href="/contact" className="text-forest hover:text-forest-deep">
          Contacts
        </Link>
      </div>
    </div>
  );
}
