import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account & Data Deletion — AMG Store",
  description:
    "How to delete your AMG Store account and what happens to your data when you do.",
};

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.09em] text-ember">Legal</p>
      <h1 className="font-display text-[clamp(30px,4vw,38px)] text-charcoal">
        Account &amp; Data Deletion
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
        You can permanently delete your AMG Store account and profile at any time, directly from
        the site — no need to contact support.
      </p>

      <div className="mt-10 space-y-10 text-[16.5px] leading-relaxed text-ink-soft">
        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">How to delete your account</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Sign in at{" "}
              <Link href="/auth/login" className="font-semibold text-forest hover:text-forest-deep">
                amgstores.ai/auth/login
              </Link>{" "}
              (if you don&apos;t have an account, there is nothing to delete).
            </li>
            <li>
              Go to{" "}
              <Link href="/account" className="font-semibold text-forest hover:text-forest-deep">
                amgstores.ai/account
              </Link>
              .
            </li>
            <li>Scroll to <strong className="font-semibold text-charcoal">Delete account</strong>, click <strong className="font-semibold text-charcoal">Delete my account</strong>, type <strong className="font-semibold text-charcoal">DELETE</strong> to confirm, and submit.</li>
          </ol>
          <p>
            Your account is deleted immediately — there is no waiting period and no email
            confirmation step required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">What gets deleted</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Your login credentials (email/password or Google sign-in link).</li>
            <li>Your profile — name, phone number, delivery town.</li>
            <li>Any push-notification subscriptions and in-app notifications tied to your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">What&apos;s retained, and why</h2>
          <p>
            Your past orders (items, prices, delivery status) are kept as business records — this is
            standard practice for accounting, tax, and dispute-resolution purposes, and matches what
            our{" "}
            <Link href="/privacy" className="font-semibold text-forest hover:text-forest-deep">
              Privacy Policy
            </Link>{" "}
            describes. These records are detached from your identity as part of deletion: the
            personal link between you and those orders is removed, so they can no longer be traced
            back to your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[24px] text-charcoal">Can&apos;t sign in?</h2>
          <p>
            If you&apos;ve lost access to your account and can&apos;t use the self-service option
            above, contact us via the{" "}
            <Link href="/contact" className="font-semibold text-forest hover:text-forest-deep">
              Contacts
            </Link>{" "}
            page and we&apos;ll process the deletion manually.
          </p>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-[15.5px] font-semibold">
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
