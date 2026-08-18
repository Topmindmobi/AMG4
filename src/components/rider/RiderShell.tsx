"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/rider", label: "Delivery kanban", exact: true },
];

export function RiderShell({ children }: { children: ReactNode }) {
  const { user, loading, isRider, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login?next=/rider");
      return;
    }
    if (!isRider) {
      router.replace(user.role === "admin" ? "/admin" : "/account");
    }
  }, [user, loading, isRider, router]);

  if (loading || !user || !isRider) {
    return (
      <div className="min-h-[50vh] bg-mist px-4 py-16 text-ink-soft">
        Checking rider access…
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-mist text-charcoal">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <AmgLogo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <NotificationBell iconClassName="text-charcoal/80" />
            <button
              type="button"
              onClick={() => void logout()}
              className="text-sm text-ink-soft hover:text-charcoal"
            >
              Log out
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs uppercase tracking-wide text-ink-soft">
          Rider portal
        </p>
        <p className="mt-1 text-lg font-semibold text-charcoal">{user.full_name}</p>
        <p className="mt-1 text-xs text-ink-soft">
          You are responsible for each assigned order until payment is registered.
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          {links.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active ? "text-ember" : "text-ink-soft transition hover:text-charcoal"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
