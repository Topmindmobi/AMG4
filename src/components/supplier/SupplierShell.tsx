"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/layout/DashboardShell";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { RoleGuardLoading } from "@/components/shared/RoleGuardLoading";
import { useAuth } from "@/lib/auth-context";
import { useRoleGuard } from "@/lib/hooks/useRoleGuard";
import {
  getDemoNotifications,
  markDemoNotificationRead,
} from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";
import type { AppNotification } from "@/lib/types";

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    links: [
      { href: "/supplier", label: "Dashboard", exact: true },
      { href: "/supplier/reports", label: "Reports" },
    ],
  },
  {
    title: "Orders",
    links: [{ href: "/supplier/requests", label: "Orders pipeline" }],
  },
  {
    title: "Catalog",
    links: [
      { href: "/supplier/products", label: "My products" },
      { href: "/supplier/inventory", label: "Inventory" },
    ],
  },
  {
    title: "Logistics",
    links: [{ href: "/supplier/addresses", label: "Addresses" }],
  },
];

export function SupplierShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const { user, ready } = useRoleGuard("supplier");
  const [notes, setNotes] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user || !isDemoMode()) return;
    void Promise.resolve(getDemoNotifications(user.id).slice(0, 8)).then(setNotes);
  }, [user, pathname]);

  if (!ready || !user) {
    return <RoleGuardLoading label="Checking supplier access…" />;
  }

  const unread = notes.filter((n) => !n.read);

  return (
    <DashboardShell
      navGroups={navGroups}
      contextCard={
        <div className="flex flex-col gap-1 rounded-[10px] bg-white/[0.09] p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8b95a8]">
            Supplier portal
          </p>
          <p className="text-xs text-[#c7ceda]">{user.full_name ?? "Supplier"}</p>
        </div>
      }
      pathname={pathname}
      footer={
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={user.full_name}
              fallback="Supplier"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-xs font-bold text-[#dfe3ea]"
            />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-white">
                {user.full_name ?? "Supplier"}
              </span>
              <span className="text-[11px] text-[#7e8798]">Supplier</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-left text-[13px] text-[#b6bece] transition hover:text-white"
          >
            Log out
          </button>
        </div>
      }
    >
      {unread.length > 0 && (
        <div className="mb-6 border border-ember/40 bg-ember/10 p-4">
          <p className="text-xs uppercase tracking-wide text-ember">Notifications</p>
          <ul className="mt-2 space-y-2 text-sm">
            {unread.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link || "/supplier/requests"}
                  onClick={() => {
                    if (isDemoMode()) {
                      markDemoNotificationRead(n.id);
                      setNotes(getDemoNotifications(user.id).slice(0, 8));
                    }
                  }}
                  className="hover:text-ember"
                >
                  <span className="font-medium">{n.title}</span>
                  <span className="mt-0.5 block text-ink-soft">{n.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
