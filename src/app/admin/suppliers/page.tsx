"use client";

import { FormEvent, useEffect, useState } from "react";
import { TOWNS } from "@/lib/format";
import { isDemoMode } from "@/lib/supabase/config";
import { getDemoSuppliers, upsertDemoSupplier } from "@/lib/store/demo-store";
import type { Supplier, Town } from "@/lib/types";

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);

  function load() {
    if (isDemoMode()) {
      setSuppliers(getDemoSuppliers());
      return;
    }
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("suppliers").select("*").order("name");
      setSuppliers((data as Supplier[]) ?? []);
    })();
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: editing?.id,
      name: String(fd.get("name")),
      contact_phone: String(fd.get("contact_phone") || "") || null,
      town: (String(fd.get("town") || "") || null) as Town | null,
      notes: String(fd.get("notes") || "") || null,
    };

    if (isDemoMode()) {
      upsertDemoSupplier(payload);
      setEditing(null);
      (e.target as HTMLFormElement).reset();
      load();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    if (editing?.id) {
      await supabase.from("suppliers").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("suppliers").insert({
        name: payload.name,
        contact_phone: payload.contact_phone,
        town: payload.town,
        notes: payload.notes,
      });
    }
    setEditing(null);
    (e.target as HTMLFormElement).reset();
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-sand">Suppliers</h1>
      <form onSubmit={onSubmit} className="mt-8 grid max-w-xl gap-3">
        <input
          name="name"
          required
          placeholder="Supplier name"
          defaultValue={editing?.name}
          key={editing?.id ?? "new"}
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <input
          name="contact_phone"
          placeholder="Phone"
          defaultValue={editing?.contact_phone ?? ""}
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <select
          name="town"
          defaultValue={editing?.town ?? ""}
          className="border border-white/15 bg-forest-deep px-3 py-2 text-sm"
        >
          <option value="">Town</option>
          {TOWNS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <textarea
          name="notes"
          placeholder="Notes"
          defaultValue={editing?.notes ?? ""}
          rows={2}
          className="border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="submit" className="bg-ember px-4 py-2 text-sm font-semibold text-white">
            {editing ? "Update" : "Add supplier"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm text-sand/50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
        {suppliers.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-sand/45">
                {s.contact_phone || "No phone"} · {s.town || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(s)}
              className="text-sand/50 hover:text-ember"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
