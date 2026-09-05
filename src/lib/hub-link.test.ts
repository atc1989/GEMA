import assert from "node:assert/strict";
import test from "node:test";

import { hubOrigin } from "./hub-link.ts";

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
