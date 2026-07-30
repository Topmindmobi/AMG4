const PILLS = [
  {
    label: "Cash on delivery",
    icon: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
  },
  {
    label: "Pay with M-Pesa",
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    label: "Delivered by boda",
    icon: (
      <>
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M6 18h6l3-9h4M9 9h6" />
      </>
    ),
  },
  {
    label: "3 towns covered",
    icon: (
      <>
        <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
  },
];

export function TrustStrip() {
  return (
    <div className="px-5 pb-1.5 pt-[22px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-wrap gap-2.5 border-b border-line pb-[30px]">
          {PILLS.map((pill) => (
            <div
              key={pill.label}
              className="flex items-center gap-1.5 rounded-full border border-line bg-sand px-3.5 py-2 text-[13px] font-semibold text-forest"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="shrink-0 text-ember"
                aria-hidden
              >
                {pill.icon}
              </svg>
              {pill.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
