/**
 * Why a signed-in person was sent to `/login`.
 *
 * Both auth guards collapse two different failures into one `null`:
 * `getCurrentProfile()` returns null for "no session" and for "the profiles
 * query errored", and the middleware's `getClaims()` returns no claims for an
 * expired token, a malformed cookie and a network failure alike. Every one of
 * them shows the member the same login page, so a report of "it sends me back
 * to login" has never been enough to say which happened.
 *
 * These helpers write one line to the server log at the moment of the redirect.
 * They change no behaviour.
 *
 * NEVER log a cookie value. A session cookie is a bearer token — anyone holding
 * the log holds the account. Names and counts only.
 */

/**
 * Count auth cookie names on the raw request header.
 *
 * The raw header rather than `request.cookies` on purpose: Next's cookie map is
 * keyed by name, so when the browser sends two cookies with the SAME name at
 * different scopes — one host-only `gema.gutguard.ph`, one `.gutguard.ph` from
 * Change 6 — the map keeps one and the duplicate becomes invisible exactly
 * where it matters. The header still has both.
 *
 * A duplicate name here is the finding. For a chunked session (`@supabase/ssr`
 * splits anything over 3180 bytes into `.0`, `.1`) it also means chunks from
 * two different sessions can be reassembled into one malformed token, which
 * fails to parse every time rather than intermittently.
 */
export function authCookieReport(cookieHeader: string | null | undefined) {
  const names = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name) && name.startsWith("sb-"));

  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);

  const duplicated = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name, count]) => `${name}×${count}`);

  return {
    authCookies: [...counts.keys()],
    duplicated,
    /** The single strongest signal that this is a cookie-scope problem. */
    hasDuplicateScope: duplicated.length > 0,
  };
}

export function logAuthRedirect(reason: string, detail: Record<string, unknown>) {
  console.warn("[auth] sending a request to /login", { reason, ...detail });
}
