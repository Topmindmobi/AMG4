"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listNotifications, markNotificationRead } from "@/lib/data/notifications";
import type { AppNotification } from "@/lib/types";

const POLL_MS = 8000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Bell + dropdown for in-app notifications. Polls so status changes show up without a manual refresh. */
export function NotificationBell({ iconClassName = "text-forest" }: { iconClassName?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => void listNotifications(user.id).then((list) => !cancelled && setNotes(list));
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!user) return null;
  const unread = notes.filter((n) => !n.read).length;

  async function onSelect(note: AppNotification) {
    setOpen(false);
    if (!note.read) {
      await markNotificationRead(note.id);
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, read: true } : n)));
    }
    if (note.link) router.push(note.link);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className={`relative inline-flex items-center ${iconClassName}`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-ember px-1 text-[12px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-line bg-white text-charcoal shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <span className="text-xs text-ink-soft">{unread} unread</span>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notes.slice(0, 15).map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => void onSelect(note)}
                  className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-sand ${
                    note.read ? "" : "bg-ember/5"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{note.title}</span>
                    <span className="shrink-0 text-[13px] text-ink-soft">{timeAgo(note.created_at)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{note.body}</span>
                </button>
              </li>
            ))}
            {notes.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-soft">No notifications yet.</li>
            )}
          </ul>
          {notes.length > 0 && (
            <Link
              href={user.role === "admin" ? "/admin" : user.role === "supplier" ? "/supplier" : user.role === "rider" ? "/rider" : "/account"}
              onClick={() => setOpen(false)}
              className="block border-t border-line px-3 py-2 text-center text-xs font-semibold text-forest hover:text-forest-deep"
            >
              Go to dashboard
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
