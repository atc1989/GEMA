/**
 * PostgREST `or` filter matching admin/member "finished vs open" rules:
 * an event is finished once `ends_at` passes, or `starts_at` when it is open-ended.
 */
export function eventTimeOrFilter(now = new Date().toISOString(), finished = false) {
  const op = finished ? "lt" : "gte";
  return `ends_at.${op}."${now}",and(ends_at.is.null,starts_at.${op}."${now}")`;
}

/**
 * Hosts cannot check in more than 6 hours after `ends_at`. Matches the
 * `record_attendance` RPC. Open-ended events (`ends_at` null) never close.
 * Admins bypass this gate in the database (`is_admin()`).
 */
export const HOST_CHECK_IN_GRACE_MS = 6 * 60 * 60 * 1000;

export function eventCheckInClosedForHosts(
  event: { ends_at?: string | null; endsAt?: string | null },
  now = Date.now(),
) {
  const endsAt = event.ends_at ?? event.endsAt;
  if (!endsAt) return false;
  return new Date(endsAt).getTime() < now - HOST_CHECK_IN_GRACE_MS;
}

/** Same rule as `eventTimeOrFilter`, for in-memory rows. */
export function eventHasEnded(
  event: { ends_at?: string | null; endsAt?: string | null; starts_at?: string; startsAt?: string },
  now = Date.now(),
) {
  const end = event.ends_at ?? event.endsAt ?? event.starts_at ?? event.startsAt;
  return end ? new Date(end).getTime() < now : false;
}

/** "Completed" is derived, never stored: nothing writes that status, so a
 * published event reads as completed once it has ended. */
export function effectiveEventStatus<T extends { status: string }>(
  event: T & Parameters<typeof eventHasEnded>[0],
  now = Date.now(),
): T["status"] | "completed" {
  return event.status === "published" && eventHasEnded(event, now) ? "completed" : event.status;
}
