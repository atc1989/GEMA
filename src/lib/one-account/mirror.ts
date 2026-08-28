import { createHash } from "node:crypto";

/**
 * Generated. Do not edit by hand — run `node rebuild-mirror.mjs` from this
 * directory in GEMA (the source of truth), then copy the whole directory into
 * Academy and Lifestyle.
 *
 * `version` is the fingerprint of the module as a whole. If the three repos
 * print different versions, one of them is stale.
 */

/** Line endings are normalised so a Windows checkout hashes the same as CI. */
function fingerprint(text: string) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

export function mirrorManifest(files: Record<string, string>) {
  const entries = Object.keys(files)
    .sort()
    .map((name) => [name, fingerprint(files[name])] as const);
  const version = createHash("sha256")
    .update(entries.map(([name, hash]) => `${name}:${hash}`).join("\n"))
    .digest("hex")
    .slice(0, 16);
  return { version, files: Object.fromEntries(entries) };
}

export const MIRROR = {
  version: "251c89c4a93b500a",
  files: {
    "README.md": "0b51cb0d80e94ecdec4e411210e29141e993ad22002c03fca6030950fee342a6",
    "identity-client.ts": "f5dce14abef256ced9f36caca8f79dab83b82ef7ea8dc57b1083f00d4ea839b6",
    "index.ts": "7382ca3a3ad1fe34f9ccd5db51d3569035c5f2d42358f5a280c29afee38cb2d8",
    "login-engine.ts": "b90f7a33a93c1b7982439a36648c70648f42faa0a0f33d1a15b615991d649517",
    "mirror.test.ts": "bc896c1bad858de96cddc4ed4807eb0955ef66ba3ea9d8037033afb2b182e204",
    "onegrinders.ts": "c1ac919597ad179019e80569740741f5e858408790b04a782726b26f15bf15e4",
    "provision.ts": "9b8d0e990a2749668b7b847039231b5bcc22efbcf3b169b061a34407c1fec843",
    "rebuild-mirror.mjs": "fa65e230152ec822bfd8cbd2a91c4afde4cfe7d94aa8564cf472663df850de6c",
    "support.test.ts": "4f9629c93d4e68cf741bc1b42906be22e3e543ab2fcac807f9130a82c6b7dd9b",
    "support.ts": "3d2086e03726a165a5f84d39f241e70a1da40265ace1af4f9bcaa81579b004f1",
  } as Record<string, string>,
};
