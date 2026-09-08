import assert from "node:assert/strict";
import test from "node:test";

import { authCookieReport } from "./auth-diagnostics.ts";

const GEMA = "sb-rvwseybgimmewuoccecu-auth-token";
const LIFESTYLE = "sb-fxdsnacuonfvutdquogb-auth-token";

test("a healthy request reports one auth cookie and no duplicates", () => {
  const report = authCookieReport(`${GEMA}=base64-eyJ; other=1`);
  assert.deepEqual(report.authCookies, [GEMA]);
  assert.equal(report.hasDuplicateScope, false);
});

test("the same name twice is the finding — two scopes of one session", () => {
  // What the browser sends when a host-only cookie from before Change 6 is
  // still there beside the new `.gutguard.ph` one. Next's cookie map is keyed
  // by name and would show only one of these.
  const report = authCookieReport(`${GEMA}=old; ${GEMA}=new`);
  assert.equal(report.hasDuplicateScope, true);
  assert.deepEqual(report.duplicated, [`${GEMA}×2`]);
});

test("duplicated chunks are caught too", () => {
  const report = authCookieReport(
    `${GEMA}.0=a; ${GEMA}.1=b; ${GEMA}.0=c; ${GEMA}.1=d`,
  );
  assert.equal(report.hasDuplicateScope, true);
  assert.deepEqual(report.duplicated.sort(), [`${GEMA}.0×2`, `${GEMA}.1×2`]);
});

test("two projects' cookies side by side are normal, not a duplicate", () => {
  // Lifestyle and GEMA both write to .gutguard.ph under the domain split.
  // Different names, so nothing is ambiguous — this must not be reported.
  const report = authCookieReport(`${GEMA}=a; ${LIFESTYLE}=b`);
  assert.equal(report.hasDuplicateScope, false);
  assert.deepEqual(report.authCookies.sort(), [LIFESTYLE, GEMA].sort());
});

test("no cookie header at all is handled, and never throws", () => {
  for (const header of [null, undefined, ""]) {
    const report = authCookieReport(header);
    assert.deepEqual(report.authCookies, []);
    assert.equal(report.hasDuplicateScope, false);
  }
});

test("only sb- cookies are reported — nothing else is logged", () => {
  // A cookie header carries session tokens for other things too. Reporting a
  // name that is not ours is a small leak for no diagnostic gain.
  const report = authCookieReport(`_vercel_jwt=x; ${GEMA}=a; ph_session=y`);
  assert.deepEqual(report.authCookies, [GEMA]);
});
