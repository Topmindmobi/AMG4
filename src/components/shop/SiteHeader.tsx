"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { getDemoNotifications } from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";

export function SiteHeader() {
  const { count, justAdded } = useCart();
  const { user, isAdmin, isSupplier, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user || !isDemoMode()) {
      setUnread(0);
      return;
    }
    setUnread(getDemoNotifications(user.id).filter((n) => !n.read).length);
  }, [user, pathname]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier")) {
    return null;
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-mist">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-4 px-5 py-3.5">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label="AMG.COM home">
          <AmgLogo priority className="h-8 w-auto sm:h-9" />
        </Link>

        <nav
          className="order-4 flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-forest sm:order-none sm:w-auto sm:gap-x-[18px]"
          aria-label="Primary"
        >
          <NavLink href="/" pathname={pathname}>
            Home
          </NavLink>
          <NavLink href="/shop" pathname={pathname}>
            Shop
          </NavLink>
          <NavLink href="/about" pathname={pathname}>
            About
          </NavLink>
          <NavLink href="/contact" pathname={pathname}>
            Contacts
          </NavLink>
        </nav>

        <form
          onSubmit={onSearch}
          className="order-3 flex min-w-0 flex-[1_1_100%] items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 sm:order-none sm:flex-[1_1_0%]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 opacity-50"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search eggs, cement, phones, school books…"
            className="w-full min-w-0 border-none bg-transparent text-sm text-charcoal outline-none placeholder:text-ink-soft/70"
            aria-label="Search products"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-4 text-sm font-semibold text-forest sm:gap-[18px]">
          {user ? (
            <>
              {!isSupplier && (
                <Link href="/account" className="hidden items-center gap-1.5 sm:inline-flex">
                  <UserIcon />
                  <span>Account</span>
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="hover:text-forest-deep">
                  Admin
                </Link>
              )}
              {isSupplier && (
                <Link href="/supplier" className="inline-flex items-center gap-1 hover:text-forest-deep">
                  Supplier
                  {unread > 0 && (
                    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Link>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="text-ink-soft transition hover:text-charcoal"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="inline-flex items-center gap-1.5">
              <UserIcon />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}

          {!isSupplier && (
            <Link
              href="/cart"
              className={`relative inline-flex items-center ${justAdded ? "animate-cart-pulse" : ""}`}
              aria-label={`Cart${count > 0 ? `, ${count} items` : ""}`}
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ember text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: ReactNode;
}) {
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      className={
        active
          ? "text-forest-deep underline decoration-ember decoration-2 underline-offset-4"
          : "hover:text-forest-deep"
      }
    >
      {children}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  );
}
