export function HeroRouteMap() {
  return (
    <div className="w-full max-w-[440px]">
      <svg viewBox="0 0 420 180" width="100%" className="overflow-visible" aria-hidden>
        <path
          d="M20,90 C 90,10 150,170 220,90 S 340,10 400,90"
          fill="none"
          stroke="#3A4499"
          strokeWidth="2.5"
          strokeDasharray="1 9"
          strokeLinecap="round"
        />
        <circle cx="20" cy="90" r="6" fill="#F0672E" />
        <circle cx="220" cy="90" r="6" fill="#F0672E" />
        <circle cx="400" cy="90" r="6" fill="#F0672E" />
        <text
          x="20"
          y="115"
          fill="#C7CCEC"
          fontFamily="var(--font-work-sans), sans-serif"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          NAIROBI
        </text>
        <text
          x="220"
          y="65"
          fill="#C7CCEC"
          fontFamily="var(--font-work-sans), sans-serif"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          KISUMU
        </text>
        <text
          x="400"
          y="115"
          fill="#C7CCEC"
          fontFamily="var(--font-work-sans), sans-serif"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
        >
          MOMBASA
        </text>
        <g className="boda-ride">
          <circle r="11" fill="#F0672E" />
          <text x="0" y="4" textAnchor="middle" fontSize="12" fill="#fff">
            🏍
          </text>
        </g>
      </svg>
      <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[#C7CCEC]">
        <strong className="font-semibold text-white">Nationwide delivery, no drama.</strong> A
        rider brings your order straight from the nearest partner shop.
      </p>
    </div>
  );
}
