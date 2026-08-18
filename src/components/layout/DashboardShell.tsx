"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";

export type NavLink = { href: string; label: string; exact?: boolean };
export type NavGroup = { title?: string; links: NavLink[] };

function isActive(pathname: string, link: NavLink): boolean {
  return link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/**
 * Shared hamburger-drawer shell for the admin and supplier portals. Both
 * used to render an always-visible sidebar (grid-cols-[Npx_1fr]) that just
 * stacked above the content on narrow screens instead of collapsing — this
 * replaces that with the same drawer pattern used for the storefront's
 * mobile nav, but as the one nav surface at every width, not just a mobile
 * fallback, so the dashboard itself stays uncluttered.
 */
export function DashboardShell({
  children,
  navGroups,
  eyebrow,
  identityLine,
  topBarExtra,
  footer,
  pathname,
}: {
  children: ReactNode;
  navGroups: NavGroup[];
  eyebrow: string;
  identityLine?: string;
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
    <div className="min-h-[70vh] bg-mist text-charcoal">
      <div className="sticky top-0 z-30 border-b border-line bg-mist">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="dashboard-drawer"
              className="inline-flex items-center justify-center text-forest"
            >
              <MenuIcon />
            </button>
            <Link href="/" className="inline-flex">
              <AmgLogo className="h-7 w-auto" />
            </Link>
          </div>
          {topBarExtra}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>

      <div
        id="dashboard-drawer"
        className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
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
          className={`absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col overflow-y-auto bg-mist text-charcoal shadow-xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
            <Link href="/" className="inline-flex">
              <AmgLogo className="h-7 w-auto" />
            </Link>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close menu"
              className="inline-flex items-center justify-center p-1 text-forest"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 pt-4">
            <p className="text-xs uppercase tracking-wide text-ink-soft">{eyebrow}</p>
            {identityLine && <p className="mt-1 text-sm text-ink-soft">{identityLine}</p>}
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-5 px-3 pb-4">
            {navGroups.map((group, i) => (
              <div key={group.title ?? i}>
                {group.title && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {group.title}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = isActive(pathname, link);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeDrawer}
                        aria-current={active ? "page" : undefined}
                        className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                          active
                            ? "bg-sand text-ember"
                            : "text-ink-soft hover:bg-sand hover:text-charcoal"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {footer && <div className="border-t border-line px-3 py-4">{footer}</div>}
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
