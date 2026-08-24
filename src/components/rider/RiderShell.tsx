"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell, type NavGroup } from "@/components/layout/DashboardShell";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { RoleGuardLoading } from "@/components/shared/RoleGuardLoading";
import { useAuth } from "@/lib/auth-context";
import { useRoleGuard } from "@/lib/hooks/useRoleGuard";

const navGroups: NavGroup[] = [
  {
    title: "Today",
    links: [
      { href: "/rider", label: "Delivery board", exact: true },
      { label: "Route map", comingSoon: true },
      { label: "Remittance", comingSoon: true },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "History", comingSoon: true },
      { label: "Earnings", comingSoon: true },
      { href: "/account", label: "Settings" },
    ],
  },
];

export function RiderShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const { user, ready } = useRoleGuard("rider");

  if (!ready || !user) {
    return <RoleGuardLoading label="Checking rider access…" />;
  }

  return (
    <DashboardShell
      navGroups={navGroups}
      contextCard={
        <div className="flex flex-col gap-2 rounded-[10px] bg-white/[0.09] p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#c9cee6]">
            Rider portal
          </p>
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={user.full_name}
              fallback="Rider"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-xs font-bold text-white"
            />
            <span className="text-sm font-bold text-white">{user.full_name ?? "Rider"}</span>
          </div>
        </div>
      }
      topBarExtra={<NotificationBell iconClassName="text-ink/80" />}
      pathname={pathname}
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-[10px] bg-white/[0.09] p-3.5">
            <span className="text-[11px] leading-relaxed text-[#c9cee6]">
              You are responsible for each assigned order until payment is registered.
            </span>
            <Link href="/contact" className="text-xs font-bold text-[#ffb593] hover:text-white">
              Escalate an issue →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-left text-[13px] text-[#c3c7e4] transition hover:text-white"
          >
            Log out
          </button>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
