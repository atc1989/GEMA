import assert from "node:assert/strict";
import test from "node:test";

import { cookieOptionsForRequestHost } from "./cookie-options.ts";

const shared = { domain: ".gutguard.ph" };

test("Gutguard hosts keep the shared parent-domain session", () => {
  assert.deepEqual(cookieOptionsForRequestHost(shared, "gutguard.ph"), shared);
  assert.deepEqual(cookieOptionsForRequestHost(shared, "gema.gutguard.ph"), shared);
  assert.deepEqual(
    cookieOptionsForRequestHost(shared, "Gema.GutGuard.PH:443"),
    shared,
  );
  assert.deepEqual(
    cookieOptionsForRequestHost(shared, "gema.gutguard.ph, proxy.internal"),
    shared,
  );
});

test("Vercel and unrelated hosts fall back to host-only cookies", () => {
  assert.equal(
    cookieOptionsForRequestHost(shared, "gema-xxxx.vercel.app"),
    undefined,
  );
  assert.equal(
    cookieOptionsForRequestHost(shared, "gutguard.ph.evil.example"),
    undefined,
  );
});

test("an unconfigured shared domain remains off", () => {
  assert.equal(cookieOptionsForRequestHost(undefined, "gema.gutguard.ph"), undefined);
});
