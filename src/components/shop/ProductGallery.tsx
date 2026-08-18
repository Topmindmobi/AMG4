"use client";

import { useMemo, useState } from "react";

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const list = useMemo(
    () => images.filter((src) => src && !broken[src]),
    [images, broken],
  );
  const [active, setActive] = useState(0);
  const safeIndex = Math.min(active, Math.max(list.length - 1, 0));
  const current = list[safeIndex];

  if (!current) {
    return (
      <div className="aspect-square rounded-xl border border-line bg-sand" />
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current}
          src={current}
          alt={`${alt} — photo ${safeIndex + 1}`}
          className="h-full w-full object-cover animate-fade-up"
          onError={() => setBroken((b) => ({ ...b, [current]: true }))}
        />
        {list.length > 1 && (
          <p className="absolute bottom-3 right-3 rounded-md bg-charcoal/70 px-2 py-1 text-[13px] text-white">
            {safeIndex + 1} / {list.length}
          </p>
        )}
      </div>
      {list.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden rounded-lg border-2 transition ${
                i === safeIndex
                  ? "border-forest"
                  : "border-transparent opacity-80 hover:opacity-100"
              }`}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setBroken((b) => ({ ...b, [src]: true }))}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
