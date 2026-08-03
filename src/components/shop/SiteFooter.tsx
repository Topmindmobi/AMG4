"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AmgLogo } from "@/components/brand/AmgLogo";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier")) return null;

  return (
    <footer className="mt-auto border-t border-line px-5 pb-[30px] pt-10">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-5">
        <div>
          <AmgLogo className="mb-2.5 h-[22px] w-auto" />
          <p className="max-w-[40ch] text-[12.5px] text-ink-soft">
            Kenya&apos;s nationwide marketplace — delivering to Nairobi, Mombasa, Kisumu, Homa Bay
            and beyond.
          </p>
        </div>
        <div className="flex flex-wrap gap-[22px] text-[13.5px] font-semibold text-forest">
          <Link href="/" className="hover:text-forest-deep">
            Home
          </Link>
          <Link href="/shop" className="hover:text-forest-deep">
            Shop
          </Link>
          <Link href="/about" className="hover:text-forest-deep">
            About
          </Link>
          <Link href="/contact" className="hover:text-forest-deep">
            Contacts
          </Link>
          <Link href="/privacy" className="hover:text-forest-deep">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-forest-deep">
            Terms of Use
          </Link>
          <Link href="/auth/signup" className="hover:text-forest-deep">
            Create account
          </Link>
          <Link href="/account/orders" className="hover:text-forest-deep">
            My orders
          </Link>
        </div>
      </div>
    </footer>
  );
}
