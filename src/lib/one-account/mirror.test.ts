import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { MIRROR, mirrorManifest } from "./mirror.ts";

/**
 * `02 - Architecture`: shared login is a module, not three divergent copies.
 * There is no monorepo, so the module is mirrored by hand into GEMA, Academy,
 * and Lifestyle. This test fails when one repo's copy has been edited without
 * re-mirroring the others.
 *
 * If it fails because you meant to change the engine: make the change in GEMA,
 * run `node src/lib/one-account/rebuild-mirror.mjs` there, then copy the whole
 * directory into the other two repos in the same change.
 */
test("the shared login module matches its mirror manifest", () => {
  const built = mirrorManifest(
    Object.fromEntries(
      readdirSync(import.meta.dirname)
        .filter((name) => name !== "mirror.ts")
        .map((name) => [name, readFileSync(join(import.meta.dirname, name), "utf8")]),
    ),
  );

  assert.deepEqual(
    built.files,
    MIRROR.files,
    "one-account module differs from its manifest — re-mirror all three repos",
  );
  assert.equal(built.version, MIRROR.version);
});

test("the manifest covers every file in the module", () => {
  const onDisk = readdirSync(import.meta.dirname)
    .filter((name) => name !== "mirror.ts")
    .sort();
  assert.deepEqual(onDisk, Object.keys(MIRROR.files).sort());
});

test("a one-character drift is caught", () => {
  const a = mirrorManifest({ "a.ts": "export const x = 1;\n" });
  const b = mirrorManifest({ "a.ts": "export const x = 2;\n" });
  assert.notEqual(a.version, b.version);
  assert.equal(createHash("sha256").update("").digest("hex").length, 64);
});
