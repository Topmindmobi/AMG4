"use client";

import Link from "next/link";
import { type ReactNode, useEffect } from "react";

type ChoiceDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  children: ReactNode;
};

/** Lightweight modal for shop cart / checkout choice steps. */
export function ChoiceDialog({
  open,
  title,
  description,
  onClose,
  children,
}: ChoiceDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      {onClose ? (
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute inset-0 bg-charcoal/45"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-charcoal/45" aria-hidden />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="amg-choice-dialog-title"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-white p-6 shadow-[0_16px_40px_rgba(14,26,99,0.18)]"
      >
        <h2
          id="amg-choice-dialog-title"
          className="font-display text-[clamp(24px,3.5vw,30px)] text-charcoal"
        >
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>}
        <div className="mt-6 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

const primaryClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-ember px-4 py-3 text-[17px] font-semibold text-white transition hover:bg-ember-deep";

const secondaryClass =
  "inline-flex w-full items-center justify-center rounded-lg border-[1.5px] border-line bg-white px-4 py-3 text-[17px] font-semibold text-forest transition hover:border-forest hover:bg-sand";

export function ChoicePrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  if (href) {
    return (
      <Link href={href} className={primaryClass} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${primaryClass} disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ChoiceSecondaryButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={secondaryClass} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={secondaryClass} onClick={onClick}>
      {children}
    </button>
  );
}
