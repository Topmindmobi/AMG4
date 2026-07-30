"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AmgLogo } from "@/components/brand/AmgLogo";
import { useAuth } from "@/lib/auth-context";
import {
  getDemoNotifications,
  markDemoNotificationRead,
} from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";
import { useState } from "react";
import type { AppNotification } from "@/lib/types";

const links = [
  { href: "/supplier", label: "Dashboard" },
  { href: "/supplier/requests", label: "Supply requests" },
  { href: "/supplier/products", label: "My products" },
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
    setNotes(getDemoNotifications(user.id).slice(0, 8));
  }, [user, pathname]);

  if (loading || !user || !isSupplier) {
    return (
      <div className="min-h-[50vh] bg-forest-deep px-4 py-16 text-sand/70">
        Checking supplier access…
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-forest-deep text-sand-light">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr] sm:px-6">
        <aside>
          <Link href="/" className="inline-flex rounded bg-white px-2 py-1">
            <AmgLogo className="h-7 w-auto" />
          </Link>
          <p className="mt-2 text-xs uppercase tracking-wide text-sand/50">
            Supplier portal
          </p>
          <p className="mt-1 text-sm text-sand/70">{user.full_name}</p>
          <nav className="mt-8 flex flex-col gap-2 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href ||
                  (link.href !== "/supplier" && pathname.startsWith(link.href))
                    ? "text-ember"
                    : "text-sand/70 transition hover:text-sand"
                }
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-6 text-left text-sand/40 hover:text-sand/70"
            >
              Log out
            </button>
          </nav>
        </aside>
        <div>
          {notes.filter((n) => !n.read).length > 0 && (
            <div className="mb-6 border border-ember/40 bg-ember/10 p-4">
              <p className="text-xs uppercase tracking-wide text-ember">Notifications</p>
              <ul className="mt-2 space-y-2 text-sm">
                {notes
                  .filter((n) => !n.read)
                  .slice(0, 3)
                  .map((n) => (
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
                        <span className="mt-0.5 block text-sand/60">{n.body}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
