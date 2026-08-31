"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/layout/DashboardShell";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { RoleGuardLoading } from "@/components/shared/RoleGuardLoading";
import { useRoleGuard } from "@/lib/hooks/useRoleGuard";

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
      { href: "/admin/callbacks", label: "Order on Call" },
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
      { href: "/admin/applications", label: "Applications" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready } = useRoleGuard("admin");

  if (!ready || !user) {
    return <RoleGuardLoading label="Checking admin access…" />;
  }

  return (
    <DashboardShell
      navGroups={navGroups}
      contextCard={
        <div className="flex flex-col gap-1 rounded-[10px] bg-white/[0.09] p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8b95a8]">
            Admin — suppliers
          </p>
          <p className="text-xs text-[#c7ceda]">Hidden from shoppers</p>
        </div>
      }
      topBarExtra={<NotificationBell iconClassName="text-ink/80" />}
      pathname={pathname}
      footer={
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={user.full_name}
              fallback="Admin"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-xs font-bold text-[#dfe3ea]"
            />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-white">
                {user.full_name ?? "Admin"}
              </span>
              <span className="text-[11px] text-[#7e8798]">Administrator</span>
            </div>
          </div>
          <Link href="/" className="text-[13px] text-[#b6bece] transition hover:text-white">
            ← Back to storefront
          </Link>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
