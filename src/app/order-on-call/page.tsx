"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/supabase/errors";
import { isDemoMode } from "@/lib/supabase/config";
import { createDemoCallbackRequest } from "@/lib/store/demo-store";

export default function OrderOnCallPage() {
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !phone.trim()) {
      setError("Name and phone are required so we can call you back.");
      return;
    }

    setLoading(true);
    try {
      if (isDemoMode()) {
        createDemoCallbackRequest({
          user_id: user?.id ?? null,
          customer_name: customerName,
          phone,
          note: note.trim() || null,
        });
        setSubmitted(true);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: rpcErr } = await supabase.rpc("request_callback", {
        p_customer_name: customerName,
        p_phone: phone,
        p_note: note.trim() || null,
        p_user_id: user?.id ?? null,
      });
      if (rpcErr) throw rpcErr;
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not send your request"));
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Order on call</p>
        <h1 className="mt-2 font-display text-[clamp(28px,4vw,36px)] text-charcoal">
          We&apos;ve got your number
        </h1>
        <p className="mt-3 text-ink-soft">
          One of our team will call {phone} shortly to take your order. No need to do anything else.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setNote("");
          }}
          className="mt-6 text-sm font-semibold text-forest underline"
        >
          Request another callback
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-ember">Order on call</p>
      <h1 className="mt-2 font-display text-[clamp(30px,4vw,38px)] text-charcoal">
        Prefer to order over the phone?
      </h1>
      <p className="mt-3 text-ink-soft">
        Leave your name and number and one of our team will call you back to take your order
        directly — no need to use the website checkout.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" value={customerName} onChange={setCustomerName} required />
          <TextField label="Phone" value={phone} onChange={setPhone} required />
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
          What do you want to order? (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. 5 bags of cement and a bunch of bananas"
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-forest"
          />
        </label>

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ember py-3 text-[17px] font-semibold text-white hover:bg-ember-deep disabled:opacity-60"
        >
          {loading ? "Sending…" : "Request a callback"}
        </button>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-forest"
      />
    </label>
  );
}
