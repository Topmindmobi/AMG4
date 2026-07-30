import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  electronics: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 18h6" />
    </>
  ),
  "household-appliances": (
    <>
      <rect x="3" y="4" width="18" height="14" rx="1" />
      <path d="M7 21h10M9 4v4h6V4" />
    </>
  ),
  "fashion-clothing": <path d="M8 3l4 3 4-3 3 5-3 2v11H5V10L2 8z" />,
  "beauty-cosmetics": <path d="M8 21h8M12 17v4M6 3h12l-1 9a5 5 0 0 1-10 0z" />,
  furniture: <path d="M3 10h18v9H3zM5 10V6h14v4M8 19v-3h8v3" />,
  "home-decor": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l6 3" />
    </>
  ),
  "farm-tools": (
    <path d="M14.7 6.3a1 1 0 0 0-1.4 0l-6 6a1 1 0 0 0 0 1.4l3 3a1 1 0 0 0 1.4 0l6-6a1 1 0 0 0 0-1.4zM6 18l-3 3" />
  ),
  beddings: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M3 12h18M7 7V5h10v2" />
    </>
  ),
  "kitchen-wares": <path d="M18 3a4 4 0 0 1 0 8M18 3H8a4 4 0 0 0 0 8h10M6 11v10M18 11v10" />,
  toys: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21c0-3 3-5 7-5s7 2 7 5M9 21v-4M15 21v-4" />
    </>
  ),
  "sporting-equipment": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a13 13 0 0 1 0 18M3 12h18" />
    </>
  ),
  "school-books": (
    <>
      <path d="M4 4h9a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
      <path d="M20 4v13" />
    </>
  ),
  "agricultural-products": <path d="M12 2c3 3 5 6 5 10a5 5 0 0 1-10 0c0-4 2-7 5-10z" />,
  hardware: <path d="M14.7 6.3l3 3M9 21l-4-4 3-8 8-3 4 4-8 3z" />,
};

const FALLBACK = (
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 12h8" />
  </>
);

export function CategoryIcon({ slug }: { slug: string }) {
  const paths = ICONS[slug] ?? FALLBACK;
  return (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-ember-deep bg-ember text-white">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {paths}
      </svg>
    </div>
  );
}
