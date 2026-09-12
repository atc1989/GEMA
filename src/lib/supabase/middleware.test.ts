import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The session-refresh middleware writes refreshed auth cookies onto
 * `supabaseResponse`. Returning a bare `NextResponse.redirect()` returns a
 * different response, so those cookies are dropped — while Supabase has already
 * rotated the refresh token server-side and invalidated the one the browser
 * still holds. The member is signed out on their next request.
 *
 * This shipped for real: the affected redirects are the ones that fire when a
 * signed-in person opens an invite or register link, so people were signed out
 * on the way into an event and could not then be checked in.
 *
 * The middleware imports `next/server`, so there is nothing to execute under
 * bare `node --test`. What can be pinned is the property that actually broke:
 * every redirect leaving that function goes through the one helper that carries
 * the cookies. A fifth redirect added without it fails here.
 */
const source = readFileSync(join(import.meta.dirname, "middleware.ts"), "utf8");

test("every redirect out of updateSession carries the refreshed session cookies", () => {
  const bare = [...source.matchAll(/return\s+NextResponse\.redirect\(/g)];
  assert.equal(
    bare.length,
    0,
    "found a redirect returned directly instead of through redirectWithSession()",
  );

  // The helper is the only place a redirect response is built, and it must copy
  // the cookies across rather than merely constructing the response.
  assert.match(source, /const redirectWithSession = \(url: URL\) => \{/);
  assert.match(source, /supabaseResponse\.cookies\.getAll\(\)/);
  assert.match(source, /redirectResponse\.cookies\.set\(cookie\)/);

  // Every branch that redirects uses it. Four today: the /admin gate, and the
  // three invite/register destinations.
  assert.equal([...source.matchAll(/return redirectWithSession\(url\)/g)].length, 4);
});

/**
 * The production log, 2026-09-08: `AuthApiError: Invalid Refresh Token:
 * Refresh Token Not Found` on every request, and ten requests inside two
 * seconds every time the admin sidebar rendered. Two properties come out of
 * that, and both live in this file.
 */

test("a prefetch does not refresh the session", () => {
  // Ten prefetches of one sidebar, ten clients, one refresh token. Supabase
  // rotates on refresh, so nine of them present a token that no longer exists.
  assert.match(source, /next-router-prefetch/);
  assert.match(source, /purpose.*prefetch|prefetch/);

  // The early return has to come before the client is built, or it refreshes
  // anyway and the guard is decoration.
  const guard = source.indexOf("next-router-prefetch");
  const client = source.indexOf("createServerClient(");
  assert.ok(guard !== -1 && guard < client, "the prefetch guard must precede createServerClient");
});

test("a failed refresh cannot clear the session cookies", () => {
  // @supabase/ssr clears the stored session when a refresh fails, and that
  // reaches setAll as a batch of empty values. Writing it signs the member out.
  assert.match(source, /cookiesToSet\.every\(\(\{ value \}\) => value === ""\)/);

  // Before any write. A guard after the loop has already sent the deletions.
  const guard = source.indexOf('every(({ value }) => value === ""');
  const write = source.indexOf("request.cookies.set(name, value)");
  assert.ok(guard !== -1 && guard < write, "the all-empty guard must precede the cookie writes");
});

test("a session the auth server declared gone has its cookie removed, at both scopes", () => {
  // Keeping a dead cookie leaves a second cookie of the same name beside the
  // next sign-in. The browser sends both, Next's map keeps one, and middleware
  // and page can read different ones — one bounce to /login, then it works.
  assert.match(source, /if \(!transient && pendingSessionClear\.length > 0\)/);

  // Host scope always, parent scope too when the shared domain is configured —
  // a Domain-scoped delete does not remove a host-only cookie of the same name.
  assert.match(source, /cookies\.set\(name, "", \{ path: "\/", maxAge: 0 \}\)/);
  assert.match(source, /domain: sharedDomain/);

  // Only on a definitive failure — a blip must still keep the session.
  const clear = source.indexOf("pendingSessionClear.length > 0");
  const classified = source.indexOf("const transient = isTransientAuthFailure(");
  assert.ok(classified !== -1 && classified < clear, "the clear must run after the error is classified");
});
