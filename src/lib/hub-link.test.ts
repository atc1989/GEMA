import assert from "node:assert/strict";
import test from "node:test";

import { hubOrigin, hubRegisterUrl } from "./hub-link.ts";

test("the hub origin is read and reduced to an origin", () => {
  assert.equal(hubOrigin("https://app.gutguard.ph"), "https://app.gutguard.ph");
  assert.equal(hubOrigin("https://app.gutguard.ph/card"), "https://app.gutguard.ph");
  assert.equal(hubOrigin("  https://app.gutguard.ph/  "), "https://app.gutguard.ph");
});

test("unconfigured is null, so the caller renders no link at all", () => {
  for (const raw of [undefined, null, "", "   "]) {
    assert.equal(hubOrigin(raw), null, String(raw));
  }
});

test("a value that is not an http(s) URL is refused", () => {
  for (const raw of ["app.gutguard.ph", "javascript:alert(1)", "not a url"]) {
    assert.equal(hubOrigin(raw), null, raw);
  }
});

const HUB = "https://lifestyle.gutguard.ph";
const SELF = "https://gema.gutguard.ph";

test("register points at the hub and asks to come back here", () => {
  // D13: account creation lives on Lifestyle only. GEMA links, never forms.
  assert.equal(
    hubRegisterUrl("/discover", HUB, SELF),
    `${HUB}/register?returnTo=${encodeURIComponent(`${SELF}/discover`)}`,
  );
});

test("the returnTo is encoded, so the hub receives one parameter", () => {
  const url = hubRegisterUrl("/invite?ref=abc", HUB, SELF);
  assert.ok(url);
  // One "?" belongs to /register; the inner one must be escaped or the hub
  // reads a truncated origin and falls back to its door card.
  assert.equal(url.split("?").length - 1, 1);
  assert.ok(url.includes(encodeURIComponent("/invite?ref=abc")));
});

test("a missing leading slash is not a different path", () => {
  assert.equal(hubRegisterUrl("discover", HUB, SELF), hubRegisterUrl("/discover", HUB, SELF));
});

test("no hub means no link at all, never a dead button", () => {
  assert.equal(hubRegisterUrl("/discover", null, SELF), null);
});

test("no origin of our own still links to register, just without a return", () => {
  // Better to reach the hub and land on its door card than not to reach it.
  assert.equal(hubRegisterUrl("/discover", HUB, undefined), `${HUB}/register`);
  assert.equal(hubRegisterUrl("/discover", HUB, "not a url"), `${HUB}/register`);
});
