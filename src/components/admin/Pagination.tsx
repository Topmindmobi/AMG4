"use client";

/**
 * Minimal prev/next + page-count pagination control for admin list pages.
 * No existing pagination component was found anywhere under src/components
 * (grepped for Pagination/pageSize/.range( before building this), so this
 * is a new, deliberately small shared piece rather than a one-off per page.
 */
export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
}: {
  /** Zero-indexed current page. */
  page: number;
  pageSize: number;
  /** Total row count from the server (Supabase `{ count: "exact" }`), or
   * null while unknown/loading — Next is left enabled optimistically then. */
  count: number | null;
  onPageChange: (page: number) => void;
}) {
  const totalPages = count != null ? Math.max(1, Math.ceil(count / pageSize)) : null;
  const hasPrev = page > 0;
  const hasNext = totalPages != null ? page + 1 < totalPages : true;

  if (count != null && count <= pageSize && page === 0) return null;

  const from = count === 0 ? 0 : page * pageSize + 1;
  const to = count != null ? Math.min(count, (page + 1) * pageSize) : (page + 1) * pageSize;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
      <p className="text-xs text-ink-soft">
        {count != null
          ? `Showing ${from}–${to} of ${count}`
          : `Page ${page + 1}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
          className="border border-line px-3 py-1.5 text-xs font-semibold text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-ink-soft">
          Page {page + 1}
          {totalPages != null ? ` of ${totalPages}` : ""}
        </span>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          className="border border-line px-3 py-1.5 text-xs font-semibold text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
