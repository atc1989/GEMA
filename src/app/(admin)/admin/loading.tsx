export default function AdminLoading() {
  return (
    <div className="grid gap-4 animate-pulse">
      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-border bg-card"
          />
        ))}
      </section>

      {/* Content rows */}
      <div className="h-9 w-40 rounded-xl bg-muted" />
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
