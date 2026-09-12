import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";

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

/**
 * Could the check not be made, or did the auth server answer "this session is
 * gone"?
 *
 * This distinction was missing and it cost a production outage. Treating every
 * error as "could not ask" means a genuinely dead session — the refresh token
 * is not in Supabase's store, and no retry will ever change that — throws
 * instead of redirecting, and the member gets a 500 on every page. A 500 is
 * worse than the login page it replaced: from /login they could at least sign
 * in again, which is exactly what a dead session needs them to do.
 *
 * - A retryable fetch failure is "we could not ask". Keep the session.
 * - An auth-server 5xx is the server breaking, not a verdict on the session.
 *   Keep the session.
 * - A 400/401/403 IS the verdict. `Invalid Refresh Token: Refresh Token Not
 *   Found` is the auth server saying this session no longer exists. Send them
 *   to sign in; nothing else recovers it.
 * - Anything unrecognised: keep the session. An unknown error is not evidence
 *   that someone is signed out.
 */
export function isTransientAuthFailure(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  if (isAuthApiError(error)) return (error.status ?? 0) >= 500;
  return true;
}
