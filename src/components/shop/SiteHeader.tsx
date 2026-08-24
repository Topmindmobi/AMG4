"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/quote", label: "Get a quote" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contacts" },
];

export function SiteHeader() {
  const { count, justAdded } = useCart();
  const { user, isAdmin, isSupplier, isRider, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/rider")
  ) {
    return null;
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-mist">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-4 px-5 py-3.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex shrink-0 items-center justify-center text-forest md:hidden"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
          >
            <MenuIcon />
          </button>

          <Link href="/" className="inline-flex shrink-0 items-center" aria-label="AMG Online Store home">
            <AmgLogo priority className="h-8 w-auto sm:h-9" />
          </Link>

          <nav
            className="order-4 hidden w-full flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-forest md:order-none md:flex md:w-auto md:gap-x-[18px]"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} pathname={pathname}>
                {link.label}
              </NavLink>
            ))}
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
            <div className="hidden items-center gap-4 sm:gap-[18px] md:flex">
              {user ? (
                <>
                  {!isSupplier && (
                    <Link href="/account" className="inline-flex items-center gap-1.5">
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
                    <Link href="/supplier" className="hover:text-forest-deep">
                      Supplier
                    </Link>
                  )}
                  {isRider && (
                    <Link href="/rider" className="hover:text-forest-deep">
                      Rider
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
                  <span>Sign in</span>
                </Link>
              )}
            </div>

            {user && <NotificationBell />}

            {!user && (
              <Link href="/auth/login" className="inline-flex items-center p-2 -m-2 md:hidden" aria-label="Sign in">
                <UserIcon />
              </Link>
            )}

            {!isSupplier && (
              <Link
                href="/cart"
                className={`inline-flex items-center p-2 -m-2 ${justAdded ? "animate-cart-pulse" : ""}`}
                aria-label={`Cart${count > 0 ? `, ${count} items` : ""}`}
              >
                <span className="relative inline-flex">
                  <CartIcon />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ember text-[12px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer — nav + account links slide in over the page instead
          of wrapping inline, so the header stays short and content starts
          higher up the screen on phones and the Android app. */}
      <div
        id="mobile-drawer"
        className={`fixed inset-0 z-50 md:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          className={`absolute inset-0 bg-charcoal/40 transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <AmgLogo className="h-8 w-auto" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex items-center justify-center p-1 text-forest"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-3 py-4 text-base font-semibold text-forest" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                pathname={pathname}
                onClick={closeDrawer}
                className="rounded-lg px-3 py-3"
                activeClassName="rounded-lg bg-sand px-3 py-3"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-line px-3 py-4">
            {user ? (
              <div className="flex flex-col gap-1 text-base font-semibold text-forest">
                {!isSupplier && (
                  <Link href="/account" onClick={closeDrawer} className="rounded-lg px-3 py-3 hover:bg-sand">
                    Account
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin" onClick={closeDrawer} className="rounded-lg px-3 py-3 hover:bg-sand">
                    Admin
                  </Link>
                )}
                {isSupplier && (
                  <Link href="/supplier" onClick={closeDrawer} className="rounded-lg px-3 py-3 hover:bg-sand">
                    Supplier
                  </Link>
                )}
                {isRider && (
                  <Link href="/rider" onClick={closeDrawer} className="rounded-lg px-3 py-3 hover:bg-sand">
                    Rider
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeDrawer();
                    void logout();
                  }}
                  className="rounded-lg px-3 py-3 text-left text-ink-soft hover:bg-sand"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                onClick={closeDrawer}
                className="block rounded-lg px-3 py-3 text-base font-semibold text-forest hover:bg-sand"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NavLink({
  href,
  pathname,
  children,
  className = "",
  activeClassName,
  onClick,
}: {
  href: string;
  pathname: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  onClick?: () => void;
}) {
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const activeClasses =
    activeClassName ?? "text-forest-deep underline decoration-ember decoration-2 underline-offset-4";
  return (
    <Link
      href={href}
      onClick={onClick}
      className={active ? `${className} ${activeClasses}` : `${className} hover:text-forest-deep`}
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

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
