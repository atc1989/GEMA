// Regenerates the MIRROR constant in mirror.ts after editing this module.
// Run from GEMA (the source of truth):  node src/lib/one-account/rebuild-mirror.mjs
// Then copy this whole directory into gentrep-academy/src/lib/ and
// GutGuard-Life-Style/lib/ in the same change.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function fingerprint(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

const entries = readdirSync(here)
  .filter((name) => name !== "mirror.ts")
  .sort()
  .map((name) => [name, fingerprint(readFileSync(join(here, name), "utf8"))]);

const version = createHash("sha256")
  .update(entries.map(([name, hash]) => `${name}:${hash}`).join("\n"))
  .digest("hex")
  .slice(0, 16);

const manifestPath = join(here, "mirror.ts");
const source = readFileSync(manifestPath, "utf8");
const replacement = `export const MIRROR = {
  version: ${JSON.stringify(version)},
  files: {
${entries.map(([name, hash]) => `    ${JSON.stringify(name)}: ${JSON.stringify(hash)},`).join("\n")}
  } as Record<string, string>,
};
`;

writeFileSync(
  manifestPath,
  source.replace(/export const MIRROR = \{[\s\S]*?\n\};\n/, replacement),
  "utf8",
);

console.log(`one-account mirror ${version} (${entries.length} files)`);
