/**
 * Fallback loading skeleton for the (member) route group.
 * Covers pages that don't have their own loading.tsx:
 * /gutguard-daily and any future member-root pages.
 */
export default function MemberRootLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      {/* Page header */}
      <div className="h-7 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-72 rounded bg-muted" />

      {/* Content rows */}
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
