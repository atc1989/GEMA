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
