"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/layout/DashboardShell";
import { useAuth } from "@/lib/auth-context";
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
  const { user, loading, isSupplier, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notes, setNotes] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login?next=/supplier");
      return;
    }
    if (!isSupplier) {
      router.replace(user.role === "admin" ? "/admin" : "/account");
    }
  }, [user, loading, isSupplier, router]);

  useEffect(() => {
    if (!user || !isDemoMode()) return;
    void Promise.resolve(getDemoNotifications(user.id).slice(0, 8)).then(setNotes);
  }, [user, pathname]);

  if (loading || !user || !isSupplier) {
    return (
      <div className="min-h-[50vh] bg-mist px-4 py-16 text-ink-soft">
        Checking supplier access…
      </div>
    );
  }

  const unread = notes.filter((n) => !n.read);

  return (
    <DashboardShell
      navGroups={navGroups}
      eyebrow="Supplier portal"
      identityLine={user.full_name ?? undefined}
      pathname={pathname}
      footer={
        <button
          type="button"
          onClick={() => void logout()}
          className="block w-full px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:text-charcoal"
        >
          Log out
        </button>
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
