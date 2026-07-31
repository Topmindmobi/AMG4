"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/order-status", label: "Order Status" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/categories", label: "Categories" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login?next=/admin");
      return;
    }
    if (!isAdmin) {
      router.replace("/account");
    }
  }, [user, loading, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-[50vh] bg-mist px-4 py-16 text-ink-soft">
        Checking admin access…
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-mist text-charcoal">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[200px_1fr] sm:px-6">
        <aside>
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="inline-flex">
              <AmgLogo className="h-7 w-auto" />
            </Link>
            <NotificationBell iconClassName="text-charcoal/80" />
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink-soft">
            Admin — suppliers hidden from shoppers
          </p>
          <nav className="mt-8 flex flex-col gap-2 text-sm">
            {links.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "text-ember"
                      : "text-ink-soft transition hover:text-charcoal"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/" className="mt-6 text-ink-soft hover:text-charcoal">
              ← Storefront
            </Link>
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
