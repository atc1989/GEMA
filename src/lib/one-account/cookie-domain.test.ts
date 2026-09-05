import assert from "node:assert/strict";
import test from "node:test";

import {
  configuredCookieDomain,
  COOKIE_DOMAIN_ENV_KEY,
  cookieDomainProblemMessage,
  guardCookieDomain,
  sharedSessionCookieOptions,
} from "./cookie-domain.ts";

test("the real parent domain is accepted, in every shape it gets typed", () => {
  for (const raw of [
    "gutguard.ph",
    ".gutguard.ph",
    "  GutGuard.PH  ",
    "https://gutguard.ph",
    "https://app.gutguard.ph/register",
  ]) {
    const result = guardCookieDomain(raw);
    assert.equal(result.ok, true, raw);
    // A URL reduces to its hostname, so a subdomain URL yields that subdomain.
    if (result.ok) assert.match(result.domain, /^\.[a-z.]*gutguard\.ph$/, raw);
  }
  assert.deepEqual(guardCookieDomain("gutguard.ph"), { ok: true, domain: ".gutguard.ph" });
});

test("a public suffix is refused, because a browser refuses it silently", () => {
  // This is the failure mode the module exists to make loud: the cookie is
  // simply never set, and nothing in the app says so.
  for (const suffix of ["vercel.app", "vercel.sh", "com.ph", "net.ph", "org.ph", "github.io"]) {
    assert.deepEqual(guardCookieDomain(suffix), { ok: false, problem: "public-suffix" }, suffix);
  }
  // `gutguard.ph` sits directly under `.ph`, so it is registrable and allowed —
  // the two-label entries above are its siblings, not its parents.
  assert.deepEqual(guardCookieDomain("gutguard.ph"), { ok: true, domain: ".gutguard.ph" });
});

test("a single label cannot carry a shared cookie", () => {
  assert.deepEqual(guardCookieDomain("ph"), { ok: false, problem: "single-label" });
  assert.deepEqual(guardCookieDomain("gutguard"), { ok: false, problem: "single-label" });
  // Reached by the label check before the suffix list, so the list need not name it.
  assert.deepEqual(guardCookieDomain("localhost"), { ok: false, problem: "single-label" });
});

test("anything that is not a bare hostname is refused", () => {
  for (const raw of [
    "gutguard.ph:443",
    "gutguard.ph/path",
    "*.gutguard.ph",
    "user:pass@gutguard.ph",
    "gut guard.ph",
    "-gutguard.ph",
    "javascript:alert(1)",
  ]) {
    const result = guardCookieDomain(raw);
    assert.equal(result.ok, false, raw);
  }
});

test("nothing configured is not an error — it is the feature being off", () => {
  assert.deepEqual(guardCookieDomain(""), { ok: false, problem: "empty" });
  assert.deepEqual(guardCookieDomain(null), { ok: false, problem: "empty" });
  assert.deepEqual(guardCookieDomain(undefined), { ok: false, problem: "empty" });
  assert.equal(configuredCookieDomain(null), null);
  assert.equal(configuredCookieDomain("  "), null);
  assert.equal(sharedSessionCookieOptions(null), undefined);
});

test("a configured domain becomes cookieOptions the client factories accept", () => {
  assert.equal(configuredCookieDomain("gutguard.ph"), ".gutguard.ph");
  assert.deepEqual(sharedSessionCookieOptions("gutguard.ph"), { domain: ".gutguard.ph" });
  assert.deepEqual(sharedSessionCookieOptions(".gutguard.ph"), { domain: ".gutguard.ph" });
});

test("a bad value falls back to off rather than to a guess", () => {
  // The alternative — stripping labels until something parses — would set a
  // cookie on a domain nobody chose.
  assert.equal(configuredCookieDomain("vercel.app"), null);
  assert.equal(configuredCookieDomain("nonsense!"), null);
  assert.equal(sharedSessionCookieOptions("vercel.app"), undefined);
});

test("the variable is NEXT_PUBLIC_, because the browser client writes these too", () => {
  // A server-only name would leave the browser writing host-only cookies while
  // the server wrote parent-domain ones: two cookies, one name, no rule.
  assert.match(COOKIE_DOMAIN_ENV_KEY, /^NEXT_PUBLIC_/);
});

test("each problem explains itself well enough to act on", () => {
  const suffix = cookieDomainProblemMessage("public-suffix", "vercel.app");
  assert.match(suffix, /public suffix/);
  assert.match(suffix, /silently/);
  assert.match(cookieDomainProblemMessage("single-label", "ph"), /registrable/);
  assert.match(cookieDomainProblemMessage("not-a-hostname", "gutguard.ph:443"), /no scheme/);
  assert.match(cookieDomainProblemMessage("empty", ""), /empty/);
});
