"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { formatKes } from "@/lib/format";

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
    <div className="border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-sand/45">{label}</p>
      <p className="mt-2 font-display text-2xl text-sand">{value}</p>
      {hint && <p className="mt-1 text-xs text-sand/45">{hint}</p>}
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
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-sand/80">{label}</span>
        <span className="text-sand/55">{display}</span>
      </div>
      <div className="h-2 bg-white/10">
        <div className="h-2 bg-ember" style={{ width: `${pct}%` }} />
      </div>
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
        <thead className="text-xs uppercase tracking-wide text-sand/45">
          <tr>
            {headers.map((h) => (
              <th key={h} className="pb-3 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-3 text-sand/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-6 text-sm text-sand/50">No data for this period.</p>
      )}
    </div>
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
    <section className="mt-8 border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-sand">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ReportFilters({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-3"
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
      <label className="text-xs uppercase tracking-wide text-sand/45">
        From
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="mt-1 block border border-white/15 bg-forest-deep px-3 py-2 text-sm text-sand"
        />
      </label>
      <label className="text-xs uppercase tracking-wide text-sand/45">
        To
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="mt-1 block border border-white/15 bg-forest-deep px-3 py-2 text-sm text-sand"
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
        className="px-3 py-2.5 text-sm text-sand/50 hover:text-sand"
      >
        Clear
      </Link>
    </form>
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
              : "border-white/15 text-sand/60 hover:text-sand"
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

export function useReportRange() {
  const params = useSearchParams();
  return {
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}
