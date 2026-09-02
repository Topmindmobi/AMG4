import Image from "next/image";
import Link from "next/link";

const HIGHLIGHTS = ["Affordable", "Fast", "Convenient"] as const;

export function HomeHero() {
  return (
    <section className="px-5 pb-2 pt-5 sm:pt-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="hero-mesh overflow-hidden rounded-2xl">
          <div className="home-hero-inner">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ember">
                Nairobi · Mombasa · Kisumu · Homa Bay
              </p>
              <h1 className="font-display mt-2 max-w-[16ch] text-[clamp(26px,3.6vw,36px)] leading-[1.15] text-white">
                Buy your dreams — it&apos;s in your hand.
              </h1>
              <p className="mt-2.5 max-w-[44ch] text-[15.5px] leading-relaxed text-[#C7CCEC] sm:text-[16px]">
                Electronics, farm supplies, hardware, and everyday essentials — delivered
                nationwide from a partner shop near you.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href="/shop"
                  className="inline-flex items-center rounded-lg bg-ember px-5 py-2.5 text-[15.5px] font-semibold text-white transition hover:bg-ember-deep"
                >
                  Shop now
                </Link>
                <Link
                  href="/quote"
                  className="inline-flex items-center rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-[15.5px] font-semibold text-white transition hover:bg-white/10"
                >
                  Get a quote
                </Link>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {HIGHLIGHTS.map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[13px] font-semibold tracking-wide text-white/90"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="home-hero-photo">
              <Image
                src="/hero/amg-hero-banner.jpg"
                alt="Shopper browsing AMG Stores on a laptop, with delivery-ready shopping bags nearby."
                fill
                priority
                sizes="(min-width: 1024px) 296px, 100vw"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 bg-black/25 px-5 py-3.5 sm:px-8 lg:px-10">
            <a
              href="tel:+254181347443"
              className="inline-flex items-center gap-2.5 text-[18px] font-bold tracking-wide text-white transition hover:text-ember"
            >
              <PhoneIcon />
              <span>
                <span className="mr-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ember">
                  Call
                </span>
                +254 181 347 443
              </span>
            </a>
            <a
              href="https://wa.me/254181347444"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-[18px] font-bold tracking-wide text-white transition hover:text-ember"
            >
              <WhatsAppIcon />
              <span>
                <span className="mr-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ember">
                  WhatsApp
                </span>
                +254 181 347 444
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a13 13 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.2A9.8 9.8 0 0 0 3.3 16.6L2 22l5.5-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-3.2.8.8-3.1-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1l-.7.8c-.1.1-.3.2-.5.1a6.6 6.6 0 0 1-1.9-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.1-.3c0-.1 0-.3-.1-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3s-.7.7-.7 1.7.8 2 1 2.1c.1.2 1.5 2.3 3.7 3.2 1.3.5 1.8.6 2.4.5.4-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
