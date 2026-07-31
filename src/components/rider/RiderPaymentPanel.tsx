"use client";

import { FormEvent, useState } from "react";
import { formatKes } from "@/lib/format";
import { normalizeKenyaPhone } from "@/lib/phone";
import type { Order } from "@/lib/types";

type Phase = "idle" | "sending" | "waiting" | "confirmed" | "error";

export function RiderPaymentPanel({
  order,
  disabled,
  onCollectCash,
  onSendMpesa,
  onDeliver,
  cashBusy,
  mpesaBusy,
  deliverBusy,
}: {
  order: Order;
  disabled: boolean;
  onCollectCash: () => void;
  onSendMpesa: (phone: string) => Promise<void>;
  onDeliver: () => void;
  cashBusy: boolean;
  mpesaBusy: boolean;
  deliverBusy: boolean;
}) {
  const [phone, setPhone] = useState(order.mpesa_phone || order.phone || "");
  const [phase, setPhase] = useState<Phase>(order.paid ? "confirmed" : "idle");
  const [localError, setLocalError] = useState<string | null>(null);

  async function submitMpesa(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const normalized = normalizeKenyaPhone(phone);
    if (!normalized) {
      setLocalError("Enter a valid Kenya mobile (e.g. 07XXXXXXXX).");
      return;
    }
    setPhase("sending");
    try {
      setPhase("waiting");
      await onSendMpesa(normalized);
      setPhase("confirmed");
    } catch (err) {
      setPhase("error");
      setLocalError(err instanceof Error ? err.message : "M-Pesa failed");
    }
  }

  if (order.paid) {
    return (
      <div className="mt-4 border border-sand/30 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sand/70">
          Payment registered
        </p>
        <p className="mt-1 text-sm text-sand">
          {formatKes(Number(order.total_kes))} received
          {order.payment_method === "mpesa" ? " via M-Pesa" : " in cash"}. Hand over
          the goods, then mark delivered — only then leave.
        </p>
        <button
          type="button"
          disabled={disabled || deliverBusy}
          onClick={onDeliver}
          className="mt-3 w-full bg-forest px-4 py-2.5 text-sm font-semibold text-sand-light disabled:opacity-50"
        >
          {deliverBusy ? "Confirming…" : "Confirm Paid — trip closed, I can leave"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border border-ember/40 bg-ember/10 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ember">
          Collect payment before leaving
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-sand/70">
          <li>Enter the client&apos;s M-Pesa phone number</li>
          <li>Send the M-Pesa push (STK) to their phone</li>
          <li>Client enters PIN and pays</li>
          <li>When confirmed, mark delivered and leave</li>
        </ol>
      </div>

      <form onSubmit={(e) => void submitMpesa(e)} className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sand/60">
          Client M-Pesa number
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            disabled={disabled || mpesaBusy || phase === "waiting"}
            className="mt-1 w-full border border-white/20 bg-forest-deep px-3 py-2.5 text-sm text-sand outline-none focus:border-ember disabled:opacity-60"
            required
          />
        </label>

        {(phase === "sending" || phase === "waiting" || mpesaBusy) && (
          <p className="border border-sand/20 bg-white/5 px-3 py-2 text-xs text-sand">
            M-Pesa push sent to <strong>{phone}</strong>. Waiting for the client to
            enter their PIN… Do not leave yet.
          </p>
        )}

        {localError && (
          <p className="text-xs text-ember">{localError}</p>
        )}

        <button
          type="submit"
          disabled={disabled || mpesaBusy || phase === "waiting"}
          className="w-full bg-ember px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {mpesaBusy || phase === "waiting" || phase === "sending"
            ? "Waiting for client to pay…"
            : `Send M-Pesa push — ${formatKes(Number(order.total_kes))}`}
        </button>
      </form>

      <div className="flex items-center gap-2 text-[11px] text-sand/40">
        <span className="h-px flex-1 bg-white/10" />
        or cash
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        disabled={disabled || cashBusy || mpesaBusy}
        onClick={onCollectCash}
        className="w-full border border-white/20 px-4 py-2 text-xs font-semibold text-sand/80 hover:text-sand disabled:opacity-50"
      >
        {cashBusy ? "Recording cash…" : "Client paid cash — mark paid"}
      </button>
    </div>
  );
}
