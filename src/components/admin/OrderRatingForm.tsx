"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  RATING_DIMENSION_LABELS,
  RATING_SUBJECT_LABELS,
} from "@/lib/format";
import {
  emptyScores,
  RATING_DIMENSIONS,
  RATING_SUBJECTS,
} from "@/lib/ratings";
import type {
  Order,
  RatingScores,
  RatingSubject,
  ServiceRating,
  SupplyRequest,
} from "@/lib/types";

type SubjectDraft = {
  scores: RatingScores;
  notes: string;
};

export function OrderRatingForm({
  order,
  supplyRequests,
  existing,
  onSave,
  onClose,
}: {
  order: Order;
  supplyRequests: SupplyRequest[];
  existing: ServiceRating[];
  onSave: (
    subjects: {
      subject: RatingSubject;
      scores: RatingScores;
      notes: string | null;
    }[],
  ) => void;
  onClose: () => void;
}) {
  const supplier = supplyRequests[0] ?? null;
  const bySubject = useMemo(() => {
    const map = new Map(existing.map((r) => [r.subject, r]));
    return map;
  }, [existing]);

  const [drafts, setDrafts] = useState<Record<RatingSubject, SubjectDraft>>(
    () => {
      const init = {} as Record<RatingSubject, SubjectDraft>;
      for (const subject of RATING_SUBJECTS) {
        const prev = bySubject.get(subject);
        init[subject] = {
          scores: prev?.scores ?? emptyScores(3),
          notes: prev?.notes ?? "",
        };
      }
      return init;
    },
  );

  function setScore(subject: RatingSubject, dim: keyof RatingScores, value: number) {
    setDrafts((d) => ({
      ...d,
      [subject]: {
        ...d[subject],
        scores: { ...d[subject].scores, [dim]: value },
      },
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(
      RATING_SUBJECTS.map((subject) => ({
        subject,
        scores: drafts[subject].scores,
        notes: drafts[subject].notes.trim() || null,
      })),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-title"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-line bg-white p-5 shadow-lg"
      >
        <h2 id="rating-title" className="font-display text-2xl text-charcoal">
          Rate order
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {order.customer_name} · {order.town} · score each area 1–5 on speed,
          turnaround, quality of service, and quality of goods.
        </p>
        {supplier && (
          <p className="mt-1 text-xs text-ink-soft">
            Supplier: {supplier.supplier_name}
            {order.rider_name_snapshot
              ? ` · Rider: ${order.rider_name_snapshot}`
              : ""}
          </p>
        )}

        <div className="mt-5 space-y-5">
          {RATING_SUBJECTS.map((subject) => (
            <fieldset
              key={subject}
              className="border border-line bg-sand/40 px-3 py-3"
            >
              <legend className="px-1 text-sm font-semibold text-charcoal">
                {RATING_SUBJECT_LABELS[subject]}
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {RATING_DIMENSIONS.map((dim) => (
                  <label
                    key={dim}
                    className="text-xs uppercase tracking-wide text-ink-soft"
                  >
                    {RATING_DIMENSION_LABELS[dim]}
                    <div className="mt-1 flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = drafts[subject].scores[dim] >= n;
                        return (
                          <button
                            key={n}
                            type="button"
                            aria-label={`${RATING_DIMENSION_LABELS[dim]} ${n}`}
                            onClick={() => setScore(subject, dim, n)}
                            className={`h-8 w-8 text-sm font-semibold ${
                              active
                                ? "bg-ember text-white"
                                : "border border-line bg-white text-ink-soft hover:border-ember"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-xs uppercase tracking-wide text-ink-soft">
                Notes
                <input
                  value={drafts[subject].notes}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [subject]: { ...d[subject], notes: e.target.value },
                    }))
                  }
                  className="mt-1 block w-full border border-line bg-white px-3 py-2 text-sm normal-case tracking-normal text-charcoal"
                  placeholder="Optional comment"
                />
              </label>
            </fieldset>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            className="bg-ember px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save ratings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
