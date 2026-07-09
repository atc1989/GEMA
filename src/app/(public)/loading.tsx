export default function PublicLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="h-7 w-48 rounded-lg bg-muted" />
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
