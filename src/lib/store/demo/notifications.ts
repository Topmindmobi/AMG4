"use client";

/** Demo-mode in-app notifications. Part of the `demo-store.ts` module split — see that file. */

import type { AppNotification } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";

/** Used by every other demo domain module to raise an in-app notification. Exported (not just
 * module-local) so orders/supply-requests/rider-payouts/quotes can call it directly. */
export function pushNotification(input: {
  user_id: string;
  title: string;
  body: string;
  link?: string | null;
  order_id?: string | null;
  supply_request_id?: string | null;
}) {
  ensureSeeded();
  const note: AppNotification = {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    read: false,
    created_at: new Date().toISOString(),
    order_id: input.order_id ?? null,
    supply_request_id: input.supply_request_id ?? null,
  };
  const list = read<AppNotification[]>(KEYS.notifications, []);
  write(KEYS.notifications, [note, ...list]);
  return note;
}

export function getDemoNotifications(userId: string): AppNotification[] {
  ensureSeeded();
  return read<AppNotification[]>(KEYS.notifications, [])
    .filter((n) => n.user_id === userId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function markDemoNotificationRead(id: string) {
  ensureSeeded();
  const list = read<AppNotification[]>(KEYS.notifications, []);
  write(
    KEYS.notifications,
    list.map((n) => (n.id === id ? { ...n, read: true } : n)),
  );
}
