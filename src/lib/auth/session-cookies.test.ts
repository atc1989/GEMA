import assert from "node:assert/strict";
import test from "node:test";

import { deadSessionCookieNames, parentCookieDomain } from "./session-cookies.ts";

const GEMA_URL = "https://rvwseybgimmewuoccecu.supabase.co";
const GEMA = "sb-rvwseybgimmewuoccecu-auth-token";
const STAGING = "sb-fxdsnacuonfvutdquogb-auth-token";

test("the parent of a subdomain host", () => {
  assert.equal(parentCookieDomain("gema.gutguard.ph"), ".gutguard.ph");
  assert.equal(parentCookieDomain("lifestyle.gutguard.ph"), ".gutguard.ph");
});

test("no parent where a cookie domain would be meaningless or rejected", () => {
  // A registrable domain has no parent to widen to, and browsers reject the
  // rest of these silently — which looks exactly like the delete not working.
  for (const host of ["gutguard.ph", "localhost", "127.0.0.1", "192.168.1.4"]) {
    assert.equal(parentCookieDomain(host), null, host);
  }
});

test("every auth cookie of this project is removed, chunked or not", () => {
  // The production state, 2026-09-08: an unchunked cookie beside chunks of a
  // different session. The library's clear batch named only the chunks.
  const present = [`${GEMA}`, `${GEMA}.0`, `${GEMA}.1`, "_vercel_jwt"];
  const names = deadSessionCookieNames(present, GEMA_URL, [`${GEMA}.0`, `${GEMA}.1`]);

  assert.ok(names.includes(GEMA), "the unchunked leftover is what shadows the next sign-in");
  assert.ok(names.includes(`${GEMA}.0`));
  assert.ok(names.includes(`${GEMA}.1`));
  assert.ok(!names.includes("_vercel_jwt"), "only auth cookies");
});

test("the spokes' session is never touched", () => {
  // Lifestyle and Academy sit on the same parent domain under the Staging ref.
  // Signing out of GEMA must not sign anyone out of Lifestyle.
  const names = deadSessionCookieNames([GEMA, STAGING, `${STAGING}.0`], GEMA_URL);
  assert.deepEqual(names, [GEMA]);
});

test("a bare sb- prefix is never used, even with an unusable Supabase URL", () => {
  // No ref means no prefix to match, so nothing is swept up by accident.
  assert.deepEqual(deadSessionCookieNames([GEMA, STAGING], "not a url"), []);
  assert.deepEqual(deadSessionCookieNames([GEMA, STAGING], "not a url", [GEMA]), [GEMA]);
});
