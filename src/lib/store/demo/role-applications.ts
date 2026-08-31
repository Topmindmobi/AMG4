"use client";

/**
 * Demo-mode mirror of 030_role_applications.sql's table + RPCs: an existing
 * demo customer applies to become a supplier/rider with KYC documents
 * (stored as data URLs — there's no real storage bucket in demo mode, same
 * as how demo product images already work), an admin approves/rejects from
 * a queue, and approval flips the applicant's demo profile role +
 * supplier_id/rider_id, mirroring approve_role_application()'s real effect.
 */

import type { DemoSession } from "./auth";
import { upsertDemoSupplier } from "./catalog";
import { ensureSeeded, KEYS, read, write } from "./core";
import { upsertDemoRider } from "./rider-payouts";
import type { Profile, RiderVehicleType, RoleApplication } from "@/lib/types";

export type RoleApplicationSubmission = Omit<
  RoleApplication,
  "id" | "status" | "reviewed_by" | "reviewed_at" | "rejection_reason" | "created_at"
>;

export function getDemoRoleApplications(userId?: string): RoleApplication[] {
  ensureSeeded();
  const list = read<RoleApplication[]>(KEYS.roleApplications, []);
  return userId ? list.filter((a) => a.user_id === userId) : list;
}

export function submitDemoRoleApplication(input: RoleApplicationSubmission): RoleApplication {
  ensureSeeded();
  const list = read<RoleApplication[]>(KEYS.roleApplications, []);
  const app: RoleApplication = {
    ...input,
    id: `app-${Date.now()}`,
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: new Date().toISOString(),
  };
  // Same rule as the real unique index: replace any existing PENDING
  // application of the same type for this user rather than stacking dupes.
  const next = list.filter((a) => !(a.user_id === input.user_id && a.type === input.type && a.status === "pending"));
  write(KEYS.roleApplications, [app, ...next]);
  return app;
}

function patchDemoProfileRole(
  userId: string,
  patch: Partial<Pick<Profile, "role" | "supplier_id" | "rider_id">>,
): void {
  const profiles = read<Profile[]>(KEYS.profiles, []);
  const idx = profiles.findIndex((p) => p.id === userId);
  if (idx < 0) return;
  const next = { ...profiles[idx]!, ...patch };
  const copy = [...profiles];
  copy[idx] = next;
  write(KEYS.profiles, copy);

  // Keep an already-logged-in session in sync so the role change is visible
  // without forcing a fresh login.
  const session = read<DemoSession | null>(KEYS.session, null);
  if (session && session.user.id === userId) {
    write(KEYS.session, { ...session, user: next });
  }
}

export function approveDemoRoleApplication(applicationId: string): RoleApplication {
  ensureSeeded();
  const list = read<RoleApplication[]>(KEYS.roleApplications, []);
  const app = list.find((a) => a.id === applicationId);
  if (!app) throw new Error("Application not found");
  if (app.status !== "pending") throw new Error("Application is not pending");

  const profiles = read<Profile[]>(KEYS.profiles, []);
  const applicant = profiles.find((p) => p.id === app.user_id);
  const fullName = applicant?.full_name ?? (app.type === "supplier" ? "Supplier" : "Rider");

  if (app.type === "supplier") {
    const supplier = upsertDemoSupplier({
      name: app.business_name || fullName,
      contact_phone: app.contact_phone,
      town: app.town,
      notes: app.notes,
    });
    patchDemoProfileRole(app.user_id, { role: "supplier", supplier_id: supplier.id });
  } else {
    const rider = upsertDemoRider({
      name: fullName,
      phone: app.contact_phone,
      town: app.town,
      vehicle: (app.vehicle as RiderVehicleType) || "boda",
      active: true,
    });
    patchDemoProfileRole(app.user_id, { role: "rider", rider_id: rider.id });
  }

  const next = list.map((a) =>
    a.id === applicationId
      ? { ...a, status: "approved" as const, reviewed_by: "demo-admin", reviewed_at: new Date().toISOString() }
      : a,
  );
  write(KEYS.roleApplications, next);
  return next.find((a) => a.id === applicationId)!;
}

export function rejectDemoRoleApplication(applicationId: string, reason: string): RoleApplication {
  ensureSeeded();
  const list = read<RoleApplication[]>(KEYS.roleApplications, []);
  const app = list.find((a) => a.id === applicationId);
  if (!app) throw new Error("Application not found");
  if (app.status !== "pending") throw new Error("Application is not pending");

  const next = list.map((a) =>
    a.id === applicationId
      ? {
          ...a,
          status: "rejected" as const,
          reviewed_by: "demo-admin",
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        }
      : a,
  );
  write(KEYS.roleApplications, next);
  return next.find((a) => a.id === applicationId)!;
}
