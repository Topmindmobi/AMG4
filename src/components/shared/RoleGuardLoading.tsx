/**
 * Loading state shown by the admin/supplier/rider shells while `useRoleGuard`
 * is still resolving the session/role. Replaces the old bare
 * "Checking … access…" text with a skeleton consistent with the pulse-block
 * pattern already used elsewhere in the app (see `src/app/shop/page.tsx`'s
 * `animate-pulse` Suspense fallback). `label` is kept for screen readers via
 * `role="status"` + `aria-live`, so assistive tech still announces the same
 * message the old text version conveyed.
 */
export function RoleGuardLoading({ label }: { label: string }) {
  return (
    <div className="min-h-[50vh] bg-mist px-4 py-16" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div
        className="mx-auto flex max-w-6xl animate-pulse flex-col gap-4"
        aria-hidden="true"
      >
        <div className="h-7 w-40 rounded-lg bg-sand" />
        <div className="h-24 w-full rounded-lg bg-sand" />
        <div className="h-24 w-full rounded-lg bg-sand" />
      </div>
    </div>
  );
}
