"use client";

/**
 * Demo-mode "Order on call" callback requests. Part of the `demo-store.ts`
 * module split — see that file.
 */

import type { CallbackRequest, CallbackRequestStatus } from "@/lib/types";
import { ensureSeeded, KEYS, read, write } from "./core";
import { pushNotification } from "./notifications";

export function createDemoCallbackRequest(input: {
  user_id: string | null;
  customer_name: string;
  phone: string;
  note: string | null;
}): CallbackRequest {
  ensureSeeded();

  const request: CallbackRequest = {
    id: `cbr-${Date.now()}`,
    user_id: input.user_id,
    customer_name: input.customer_name,
    phone: input.phone,
    note: input.note,
    status: "pending",
    created_at: new Date().toISOString(),
    contacted_at: null,
    contacted_by: null,
  };

  const list = read<CallbackRequest[]>(KEYS.callbackRequests, []);
  write(KEYS.callbackRequests, [request, ...list]);

  pushNotification({
    user_id: "demo-admin",
    title: "New callback request",
    body: `${input.customer_name} (${input.phone}) asked to be called back to place an order.`,
    link: "/admin/callbacks",
  });

  return request;
}

export function getDemoCallbackRequests(): CallbackRequest[] {
  ensureSeeded();
  return read<CallbackRequest[]>(KEYS.callbackRequests, []).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export function setDemoCallbackStatus(id: string, status: CallbackRequestStatus): void {
  ensureSeeded();
  const list = read<CallbackRequest[]>(KEYS.callbackRequests, []);
  write(
    KEYS.callbackRequests,
    list.map((r) =>
      r.id === id
        ? {
            ...r,
            status,
            contacted_at: status !== "pending" ? (r.contacted_at ?? new Date().toISOString()) : r.contacted_at,
          }
        : r,
    ),
  );
}
