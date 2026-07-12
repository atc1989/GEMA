export default function AdminEventDetailLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      {/* Back link + title row */}
      <div className="h-5 w-32 rounded-lg bg-muted" />
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          <div className="h-8 w-64 rounded-lg bg-muted" />
          <div className="h-4 w-48 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-muted" />
      </div>

      {/* Detail rows card */}
      <div className="h-44 rounded-2xl border border-border bg-card" />

      {/* Poster + speaker/QR card */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="aspect-[4/5] rounded-xl border border-border bg-card" />
        <div className="rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
