"use client";

import { useEffect, useState } from "react";
import { RIDER_VEHICLE_LABELS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import {
  approveDemoRoleApplication,
  getDemoRoleApplications,
  rejectDemoRoleApplication,
} from "@/lib/store/demo-store";
import type { RoleApplication } from "@/lib/types";

type DocEntry = { label: string; path: string };

function docEntries(app: RoleApplication): DocEntry[] {
  const entries: DocEntry[] = [];
  if (app.national_id_path) entries.push({ label: "National ID", path: app.national_id_path });
  if (app.business_permit_path) entries.push({ label: "Business permit / KRA PIN", path: app.business_permit_path });
  if (app.driving_license_path) entries.push({ label: "Driving license", path: app.driving_license_path });
  return entries;
}

async function notifyApplicant(app: RoleApplication, decision: "approved" | "rejected", reason?: string) {
  try {
    const res = await fetch("/api/applications/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: app.email, type: app.type, decision, reason: reason ?? null }),
    });
    if (!res.ok) {
      console.error("[applications] notify HTTP", res.status);
      return;
    }
    const data = (await res.json()) as { sent?: boolean; error?: string; reason?: string };
    if (!data.sent) {
      console.warn("[applications] notify not sent:", data.error ?? data.reason ?? "unknown");
    }
  } catch (err) {
    console.error("[applications] notify failed:", err);
  }
}

function DocLink({ entry }: { entry: DocEntry }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isDemoMode() || entry.path.startsWith("data:")) {
      setUrl(entry.path);
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(entry.path, 3600);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.path]);

  if (!url) return <span className="text-xs text-ink-soft">{entry.label} (loading…)</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-forest hover:underline">
      {entry.label}
    </a>
  );
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function load() {
    if (isDemoMode()) {
      setApplications(getDemoRoleApplications());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("role_applications")
        .select("*")
        .order("created_at", { ascending: false });
      setApplications((data as RoleApplication[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(app: RoleApplication) {
    setBusy(app.id);
    setMessage(null);
    try {
      if (isDemoMode()) {
        approveDemoRoleApplication(app.id);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("approve_role_application", { p_application_id: app.id });
        if (error) throw error;
      }
      await notifyApplicant(app, "approved");
      setMessage(`Approved — ${app.email} notified.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject(app: RoleApplication) {
    setBusy(app.id);
    setMessage(null);
    try {
      if (isDemoMode()) {
        rejectDemoRoleApplication(app.id, reason);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.rpc("reject_role_application", {
          p_application_id: app.id,
          p_reason: reason,
        });
        if (error) throw error;
      }
      await notifyApplicant(app, "rejected", reason);
      setMessage(`Rejected — ${app.email} notified.`);
      setRejectingId(null);
      setReason("");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  const pending = applications.filter((a) => a.status === "pending");
  const decided = applications.filter((a) => a.status !== "pending");

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Applications</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Supplier and rider self-registration requests, with KYC documents for review.
      </p>
      {message && <p className="mt-4 text-sm text-forest">{message}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Pending ({pending.length})
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {pending.map((app) => (
          <li key={app.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-charcoal">
                  {app.business_name || (app.type === "rider" ? RIDER_VEHICLE_LABELS[app.vehicle as keyof typeof RIDER_VEHICLE_LABELS] ?? app.vehicle : "")}
                  <span className="ml-2 text-xs font-semibold uppercase text-ember">{app.type}</span>
                </p>
                <p className="text-xs text-ink-soft">
                  {app.email} · {app.contact_phone} · {app.town}
                </p>
                {app.notes && <p className="mt-1 text-xs text-ink-soft">{app.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-3">
                  {docEntries(app).map((entry) => (
                    <DocLink key={entry.label} entry={entry} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === app.id}
                  onClick={() => void approve(app)}
                  className="bg-forest px-3 py-2 text-xs font-semibold text-sand-light disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === app.id}
                  onClick={() => setRejectingId(rejectingId === app.id ? null : app.id)}
                  className="border border-ember px-3 py-2 text-xs font-semibold text-ember disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
            {rejectingId === app.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (shown to applicant)"
                  className="flex-1 border border-line bg-white px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={busy === app.id}
                  onClick={() => void reject(app)}
                  className="bg-ember px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Confirm reject
                </button>
              </div>
            )}
          </li>
        ))}
        {pending.length === 0 && <li className="py-6 text-center text-sm text-ink-soft">No pending applications.</li>}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-soft">Decided</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {decided.map((app) => (
          <li key={app.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium text-charcoal">
                {app.business_name || app.email}
                <span className="ml-2 text-xs font-semibold uppercase text-ink-soft">{app.type}</span>
              </p>
              <p className="text-xs text-ink-soft">
                {app.status === "approved" ? "Approved" : `Rejected${app.rejection_reason ? `: ${app.rejection_reason}` : ""}`}
              </p>
            </div>
          </li>
        ))}
        {decided.length === 0 && <li className="py-6 text-center text-sm text-ink-soft">No decided applications yet.</li>}
      </ul>
    </div>
  );
}
