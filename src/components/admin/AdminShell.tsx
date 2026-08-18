"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/layout/DashboardShell";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/lib/auth-context";

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    links: [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  {
    title: "Orders",
    links: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/order-status", label: "Order Status" },
      { href: "/admin/quotes", label: "Quotes" },
    ],
  },
  {
    title: "Catalog",
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/admin/suppliers", label: "Suppliers" },
      { href: "/admin/riders", label: "Riders" },
    ],
  },
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
    <DashboardShell
      navGroups={navGroups}
      eyebrow="Admin — suppliers hidden from shoppers"
      topBarExtra={<NotificationBell iconClassName="text-charcoal/80" />}
      pathname={pathname}
      footer={
        <Link href="/" className="block px-3 py-2 text-sm font-semibold text-ink-soft hover:text-charcoal">
          ← Storefront
        </Link>
      }
    >
      {children}
    </DashboardShell>
  );
}
