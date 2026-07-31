"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { formatKes } from "@/lib/format";
import type { ReportRange } from "@/lib/reports";

export function ReportStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-line bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-2xl text-charcoal">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export function ReportBar({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-charcoal/80">{label}</span>
        <span className="tabular-nums text-ink-soft">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-ember" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Dark-mode-validated categorical pair (see dataviz skill) — used only where two
 * segments sit adjacent with no room for a direct label, so color must carry identity. */
const SERIES_A = "#3987e5"; // blue
const SERIES_B = "#d95926"; // orange

export function ReportStackedBar({
  segments,
}: {
  segments: { label: string; value: number }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const colors = [SERIES_A, SERIES_B, "#9085e9", "#199e70"];
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/10">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label}
              style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
              title={`${seg.label}: ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <li key={seg.label} className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: colors[i % colors.length] }}
              aria-hidden
            />
            {seg.label} · <span className="tabular-nums">{((seg.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-hue line + area trend, with a hover crosshair/tooltip (dataviz skill: ship interaction by default). */
const TREND_WIDTH = 600;
const TREND_HEIGHT = 160;
const TREND_PADDING = { top: 10, right: 10, bottom: 22, left: 10 };

export function ReportTrendChart({
  points,
  formatValue = money,
}: {
  points: { date: string; amount: number }[];
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const { path, areaPath, coords, max } = useMemo(() => {
    const max = Math.max(...points.map((p) => p.amount), 1);
    const innerW = TREND_WIDTH - TREND_PADDING.left - TREND_PADDING.right;
    const innerH = TREND_HEIGHT - TREND_PADDING.top - TREND_PADDING.bottom;
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
      x: TREND_PADDING.left + i * step,
      y: TREND_PADDING.top + innerH - (p.amount / max) * innerH,
      ...p,
    }));
    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
    const areaPath =
      coords.length > 0
        ? `${path} L${coords[coords.length - 1].x},${TREND_PADDING.top + innerH} L${coords[0].x},${TREND_PADDING.top + innerH} Z`
        : "";
    return { path, areaPath, coords, max };
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-ink-soft">No data for this period.</p>;
  }

  const active = hover != null ? coords[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
        className="w-full touch-none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * TREND_WIDTH;
          let nearest = 0;
          let best = Infinity;
          coords.forEach((c, i) => {
            const d = Math.abs(c.x - x);
            if (d < best) {
              best = d;
              nearest = i;
            }
          });
          setHover(nearest);
        }}
      >
        <line
          x1={TREND_PADDING.left}
          y1={TREND_HEIGHT - TREND_PADDING.bottom}
          x2={TREND_WIDTH - TREND_PADDING.right}
          y2={TREND_HEIGHT - TREND_PADDING.bottom}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
        <path d={areaPath} fill={SERIES_A} opacity={0.1} stroke="none" />
        <path d={path} fill="none" stroke={SERIES_A} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active && (
          <>
            <line
              x1={active.x}
              y1={TREND_PADDING.top}
              x2={active.x}
              y2={TREND_HEIGHT - TREND_PADDING.bottom}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
            />
            <circle cx={active.x} cy={active.y} r={4} fill={SERIES_A} stroke="#0a1350" strokeWidth={2} />
          </>
        )}
        {coords.length > 0 && (
          <>
            <text x={coords[0].x} y={TREND_HEIGHT} fontSize={9} fill="rgba(238,241,246,0.45)">
              {coords[0].date.slice(5)}
            </text>
            <text
              x={coords[coords.length - 1].x}
              y={TREND_HEIGHT}
              fontSize={9}
              fill="rgba(238,241,246,0.45)"
              textAnchor="end"
            >
              {coords[coords.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded border border-line bg-forest-deep px-2 py-1 text-xs text-charcoal shadow-lg"
          style={{ left: `${(active.x / TREND_WIDTH) * 100}%` }}
        >
          <p className="whitespace-nowrap font-semibold">{formatValue(active.amount)}</p>
          <p className="whitespace-nowrap text-ink-soft">{active.date}</p>
        </div>
      )}
      <p className="mt-1 text-right text-xs text-ink-soft">Peak {formatValue(max)}</p>
    </div>
  );
}

export function ReportTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            {headers.map((h) => (
              <th key={h} className="pb-3 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-3 tabular-nums text-charcoal/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-6 text-sm text-ink-soft">No data for this period.</p>
      )}
    </div>
  );
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function ReportExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function download() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-charcoal disabled:opacity-40"
    >
      Export CSV
    </button>
  );
}

export function ReportSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mt-8 border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-charcoal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportFilters({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  function applyPreset(days: number) {
    const sp = new URLSearchParams();
    sp.set("from", isoDaysAgo(days));
    sp.set("to", isoDaysAgo(0));
    router.push(`${basePath}?${sp.toString()}`);
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days)}
            className="border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ember hover:text-ember"
          >
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const sp = new URLSearchParams();
          const f = String(fd.get("from") || "");
          const t = String(fd.get("to") || "");
          if (f) sp.set("from", f);
          if (t) sp.set("to", t);
          const q = sp.toString();
          router.push(q ? `${basePath}?${q}` : basePath);
        }}
      >
        <label className="text-xs uppercase tracking-wide text-ink-soft">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 block border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-ink-soft">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 block border border-line bg-white px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <button
          type="submit"
          className="bg-ember px-4 py-2.5 text-sm font-semibold text-white"
        >
          Apply
        </button>
        <Link
          href={basePath}
          className="px-3 py-2.5 text-sm text-ink-soft hover:text-charcoal"
        >
          Clear
        </Link>
      </form>
    </div>
  );
}

export function ReportTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  const links = [
    { href: "/admin/reports", label: "Overview" },
    { href: "/admin/reports/financial", label: "Financial" },
    { href: "/admin/reports/sales", label: "Sales" },
    { href: "/admin/reports/products", label: "Products" },
    { href: "/admin/reports/logistics", label: "Logistics" },
    { href: "/admin/reports/payments", label: "Payments" },
    { href: "/admin/reports/quotes", label: "Quotes" },
    { href: "/admin/reports/riders", label: "Riders" },
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={`${link.href}${suffix}`}
          className={`border px-3 py-1.5 text-xs font-medium ${
            pathname === link.href
              ? "border-ember text-ember"
              : "border-line text-ink-soft hover:text-charcoal"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export function money(n: number) {
  return formatKes(Math.round(n));
}

export function useReportRange(): ReportRange {
  const params = useSearchParams();
  return {
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

/** Fetch a report for the active date range, refetching whenever the range changes. */
export function useReportData<T>(
  fetcher: (range: ReportRange) => Promise<T>,
  range: ReportRange,
): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetcher(range).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);
  return data;
}
