"use client";

import { useState } from "react";

/** Small controlled 1-5 star input, used for order/delivery/product ratings. */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 22,
  label,
}: {
  value: number;
  onChange?: (next: number) => void;
  readOnly?: boolean;
  size?: number;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="inline-flex items-center gap-1" role={readOnly ? undefined : "radiogroup"} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={n === value}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(null)}
            className={readOnly ? "cursor-default" : "cursor-pointer"}
            style={{ fontSize: size, lineHeight: 1 }}
          >
            <span className={filled ? "text-ember" : "text-line"}>★</span>
          </button>
        );
      })}
    </div>
  );
}
