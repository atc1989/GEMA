export default function DashboardLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      {/* Today hero */}
      <div className="h-72 rounded-2xl bg-muted" />

      {/* Tips + next event cards */}
      <div className="h-20 rounded-2xl border border-border bg-card" />
      <div className="h-24 rounded-2xl border border-border bg-card" />

      {/* Quick action buttons */}
      <div className="flex gap-2">
        <div className="h-10 w-40 rounded-xl bg-muted" />
        <div className="h-10 w-36 rounded-xl bg-muted" />
        <div className="h-10 w-28 rounded-xl bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
