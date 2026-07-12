export default function DashboardLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      {/* MusterReminder skeleton */}
      <div className="h-28 rounded-2xl border border-border bg-card" />

      {/* TodayHero skeleton */}
      <div className="overflow-hidden rounded-2xl bg-brand/10">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_0.75fr] lg:p-6">
          <div className="grid gap-3">
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-7 w-48 rounded-lg bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="mt-2 flex items-center gap-3">
              <div className="size-14 shrink-0 rounded-2xl bg-muted" />
              <div className="grid gap-2">
                <div className="h-8 w-16 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
            </div>
            <div className="mt-2 h-12 rounded-xl bg-muted" />
          </div>
          {/* Week cells */}
          <div className="rounded-2xl bg-muted/40 p-3">
            <div className="mb-2 h-4 w-20 rounded bg-muted" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-[68px] rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tips card */}
      <div className="h-20 rounded-2xl border border-border bg-card" />

      {/* Next event card */}
      <div className="h-28 rounded-2xl border border-border bg-card" />

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-36 rounded-xl bg-muted" />
        <div className="h-9 w-32 rounded-xl bg-muted" />
        <div className="h-9 w-24 rounded-xl bg-muted" />
      </div>

      {/* Recent prospects list */}
      <div className="rounded-2xl border border-border bg-card p-0">
        <div className="border-b border-border/70 px-4 py-3">
          <div className="h-4 w-36 rounded bg-muted" />
        </div>
        <ul>
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-0"
            >
              <div className="grid gap-1.5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-5 w-16 rounded-lg bg-muted" />
            </li>
          ))}
        </ul>
      </div>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-card" />
        ))}
      </section>
    </div>
  );
}
