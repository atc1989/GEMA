export default function MemberEventDetailLoading() {
  return (
    <div className="mx-auto grid max-w-2xl animate-pulse gap-4">
      {/* Back link */}
      <div className="h-5 w-28 rounded-lg bg-muted" />

      {/* Pass / RSVP card */}
      <div className="h-64 rounded-2xl border border-border bg-card" />

      {/* Event details */}
      <div className="h-80 rounded-2xl border border-border bg-card" />
    </div>
  );
}
