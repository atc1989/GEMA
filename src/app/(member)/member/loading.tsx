export default function MemberLoading() {
  return (
    <div className="grid gap-4 animate-pulse">
      {/* Header row */}
      <div className="h-7 w-48 rounded-lg bg-muted" />

      {/* Content cards */}
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
