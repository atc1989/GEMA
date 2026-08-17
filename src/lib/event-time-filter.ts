/**
 * PostgREST `or` filter matching admin/member "finished vs open" rules:
 * an event is finished once `ends_at` passes, or `starts_at` when it is open-ended.
 */
export function eventTimeOrFilter(now = new Date().toISOString(), finished = false) {
  const op = finished ? "lt" : "gte";
  return `ends_at.${op}."${now}",and(ends_at.is.null,starts_at.${op}."${now}")`;
}
