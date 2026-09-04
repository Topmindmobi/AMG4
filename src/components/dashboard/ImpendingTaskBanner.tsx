import Link from "next/link";

/** Red "most urgent thing right now" banner shown at the top of the admin,
 * supplier, and rider dashboards. Each dashboard computes its own ranked
 * list of candidate tasks and passes through only the single top one — this
 * component is just the shared presentation. */
export function ImpendingTaskBanner({
  title,
  description,
  href,
  linkLabel,
  dark = false,
}: {
  title: string;
  description?: string;
  href: string;
  linkLabel: string;
  /** Rider dashboard runs a dark theme — flips text colors to stay readable. */
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`mb-6 block border-2 border-crimson px-4 py-3.5 transition ${
        dark ? "bg-crimson/20 hover:bg-crimson/25" : "bg-crimson/10 hover:bg-crimson/15"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-crimson">Needs your attention</p>
      <p className={`mt-1 text-base font-semibold ${dark ? "text-sand" : "text-charcoal"}`}>{title}</p>
      {description && (
        <p className={`mt-0.5 text-sm ${dark ? "text-sand/60" : "text-ink-soft"}`}>{description}</p>
      )}
      <span className="mt-2 inline-block text-sm font-semibold text-crimson">{linkLabel} →</span>
    </Link>
  );
}
