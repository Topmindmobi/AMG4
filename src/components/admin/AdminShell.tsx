"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
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
      <div className="min-h-[50vh] bg-charcoal px-4 py-16 text-sand/70">
        Checking admin access…
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-forest-deep text-sand-light">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[200px_1fr] sm:px-6">
        <aside>
          <Link href="/" className="inline-flex rounded bg-white px-2 py-1">
            <AmgLogo className="h-7 w-auto" />
          </Link>
          <p className="mt-1 text-xs uppercase tracking-wide text-sand/50">
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
                      : "text-sand/70 transition hover:text-sand"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/" className="mt-6 text-sand/40 hover:text-sand/70">
              ← Storefront
            </Link>
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
