"use client";

import {
  ChoiceDialog,
  ChoicePrimaryButton,
  ChoiceSecondaryButton,
} from "@/components/shop/ChoiceDialog";
import { formatKes } from "@/lib/format";
import type { SupplierScorecard } from "@/lib/supplier-selection";

export function SupplierCompareDialog({
  open,
  onClose,
  orderLabel,
  scorecards,
  rationale,
  selectedId,
  onSelect,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  orderLabel: string;
  scorecards: SupplierScorecard[];
  rationale: string;
  selectedId: string | null;
  onSelect: (supplierId: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const selected = scorecards.find((s) => s.supplier.id === selectedId) ?? scorecards[0];

  return (
    <ChoiceDialog
      open={open}
      title="Supplier value analysis"
      description={`Compare suppliers for ${orderLabel}. Scores cover availability, landed cost (goods + transport), and distance — closer origins mean cheaper inbound transport.`}
      onClose={onClose}
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-left">
        <div className="rounded-lg border border-forest/20 bg-forest/5 px-3 py-3 text-sm text-charcoal">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest">AI recommendation</p>
          <p className="mt-1.5 leading-relaxed text-ink-soft">{rationale}</p>
        </div>

        <ul className="space-y-2">
          {scorecards.map((card) => {
            const active = selected?.supplier.id === card.supplier.id;
            return (
              <li key={card.supplier.id}>
                <button
                  type="button"
                  onClick={() => onSelect(card.supplier.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? "border-ember bg-ember/5"
                      : "border-line bg-white hover:border-forest/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-charcoal">
                        #{card.rank} {card.supplier.name}
                        {card.isRecommended && (
                          <span className="ml-2 text-xs font-semibold text-ember">Best value</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        From {card.originLabel} · ~{card.distanceKm} km
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        Goods {formatKes(card.quoteKes)} + transport{" "}
                        {formatKes(card.transportKes)} = landed{" "}
                        <span className="font-semibold text-charcoal">
                          {formatKes(card.landedKes)}
                        </span>
                      </p>
                    </div>
                    <p className="font-display text-xl text-forest">{card.valueScore}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <ScorePill label="Availability" value={card.availabilityScore} />
                    <ScorePill label="Landed" value={card.priceScore} />
                    <ScorePill label="Distance" value={card.distanceScore} />
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    Covers {card.coveredLines}/{card.totalLines} lines ({card.coveragePct}% full match)
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <ChoicePrimaryButton
        onClick={onConfirm}
        disabled={busy || !selected || (selected?.coveredLines ?? 0) < 1}
      >
        {busy
          ? "Ordering…"
          : selected && selected.coveredLines < 1
            ? "No stock from this supplier"
            : `Order from ${selected?.supplier.name ?? "supplier"}`}
      </ChoicePrimaryButton>
      <ChoiceSecondaryButton onClick={onClose}>Back</ChoiceSecondaryButton>
    </ChoiceDialog>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-sand px-1.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-semibold text-charcoal">{value}</p>
    </div>
  );
}
