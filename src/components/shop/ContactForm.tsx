"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setName(String(fd.get("name") || "").trim());
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-[10px] border border-line bg-sand px-5 py-6">
        <p className="font-display text-[20px] text-charcoal">
          Thanks{name ? `, ${name}` : ""} — message received.
        </p>
        <p className="mt-2 text-[14.5px] text-ink-soft">
          For urgent orders, call or WhatsApp{" "}
          <a href="tel:+254700000000" className="font-semibold text-forest hover:text-forest-deep">
            +254 700 000 000
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setName("");
          }}
          className="mt-4 text-[13.5px] font-semibold text-forest hover:text-forest-deep"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Name
        <input
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Phone or email
        <input
          name="contact"
          type="text"
          required
          placeholder="+254… or you@example.com"
          className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Town
        <select
          name="town"
          defaultValue="Homabay"
          className="amg-select mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-forest"
        >
          <option value="Homabay">Homabay</option>
          <option value="Mbita">Mbita</option>
          <option value="Migori">Migori</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Message
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Order question, delivery area, or supplier interest…"
          className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-ember px-[22px] py-3 text-[15px] font-semibold text-white transition hover:bg-ember-deep"
      >
        Send message
      </button>
    </form>
  );
}
