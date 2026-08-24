"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";

export type NavLink =
  | { href: string; label: string; exact?: boolean; badge?: string; comingSoon?: false }
  | { href?: undefined; label: string; badge?: string; comingSoon: true };
export type NavGroup = { title?: string; links: NavLink[] };

function isActive(pathname: string, link: NavLink): boolean {
  if (!link.href) return false;
  return link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function NavLinks({
  navGroups,
  pathname,
  onLinkClick,
}: {
  navGroups: NavGroup[];
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      {navGroups.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title && (
            <p className="px-3 pb-1.5 pt-4 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/95 first:pt-0">
              {group.title}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              if (link.comingSoon) {
                return (
                  <span
                    key={link.label}
                    title="Coming soon"
                    className="flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#6d7789]"
                  >
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="font-mono text-[11px] text-[#5d6a82]">{link.badge}</span>
                    )}
                  </span>
                );
              }
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onLinkClick}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-accent/[0.22] font-bold text-[#ff9c6b]"
                      : "font-normal text-[#b6bece] hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="font-mono text-[11px] text-[#7e8798]">{link.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function SidebarContent({
  navGroups,
  contextCard,
  footer,
  pathname,
  onLinkClick,
}: {
  navGroups: NavGroup[];
  contextCard: ReactNode;
  footer?: ReactNode;
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      <div className="px-[22px] pb-[22px]">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-accent font-display-serif text-[15px] text-white">
            A
          </span>
          <span className="text-[15px] font-bold tracking-[0.04em] text-white">AMG</span>
        </Link>
      </div>

      <div className="mx-[22px] mb-5">{contextCard}</div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        <NavLinks navGroups={navGroups} pathname={pathname} onLinkClick={onLinkClick} />
      </nav>

      {footer && (
        <div className="mt-auto border-t border-white/[0.09] px-[22px] pt-4 pb-6">{footer}</div>
      )}
    </>
  );
}

/**
 * Shared shell for the admin, supplier, and rider portals: a persistent dark
 * indigo-gradient sidebar on desktop (lg: and up) and the same slide-in
 * drawer pattern used for the storefront's mobile nav below that.
 *
 * `contextCard` replaces what used to be a fixed eyebrow+identityLine pair —
 * admin/supplier pass a small two-line text card, rider passes a richer
 * identity card (avatar, shift status). Keeping it a plain ReactNode slot
 * means this shell doesn't need to know the shape of what each portal wants
 * to show there.
 */
export function DashboardShell({
  children,
  navGroups,
  contextCard,
  topBarExtra,
  footer,
  pathname,
}: {
  children: ReactNode;
  navGroups: NavGroup[];
  contextCard: ReactNode;
  topBarExtra?: ReactNode;
  footer?: ReactNode;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="bg-canvas text-ink lg:flex lg:min-h-screen">
      <aside
        className="hidden shrink-0 bg-[linear-gradient(180deg,#141768_0%,#1d1c6e_45%,#332d78_100%)] pt-6 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[236px] lg:flex-col"
      >
        <SidebarContent navGroups={navGroups} contextCard={contextCard} footer={footer} pathname={pathname} />
      </aside>

      <div className="min-w-0 lg:flex-1">
        <div className="sticky top-0 z-30 border-b border-card-border bg-canvas">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="dashboard-drawer"
                className="inline-flex items-center justify-center text-ink lg:hidden"
              >
                <MenuIcon />
              </button>
              <Link href="/" className="inline-flex lg:hidden">
                <AmgLogo className="h-7 w-auto" />
              </Link>
            </div>
            {topBarExtra}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
      </div>

      <div
        id="dashboard-drawer"
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-charcoal/40 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeDrawer}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col overflow-y-auto bg-[linear-gradient(180deg,#141768_0%,#1d1c6e_45%,#332d78_100%)] pt-6 text-white shadow-xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-end px-[22px]">
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-lg bg-white/[0.08] p-1.5 text-white"
            >
              <CloseIcon />
            </button>
          </div>
          <SidebarContent
            navGroups={navGroups}
            contextCard={contextCard}
            footer={footer}
            pathname={pathname}
            onLinkClick={closeDrawer}
          />
        </div>
      </div>
    </div>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
