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
  version: "b6fd482b0f17a829",
  files: {
    "README.md": "eb0fae9cbd9df6a4b0412a3b2ac5d7a0f86a80fdca02f208ba3dad0a329be6b6",
    "client.ts": "aaebfe4f227c871a70d6ec391c38c049d0daf419904ded841665a43c62715817",
    "email-code.ts": "96d83d1624d7c2ebfc11fd79cb3976e0bf8e6d718ba00e122178dc8b1c6819b1",
    "identity-client.ts": "c4d293e534723c4d93e980bdd2e7d8e0c502a8770eb928058b42c369c0f78af7",
    "index.ts": "a1eca9c952d0c0a9bbb140f428c2ccefc22318ea78174a9eff12630fd2671843",
    "login-engine.ts": "3043fb0030d2a21cbfe4d36d3af0c1e7bea0e3603b2d58ae3e84b77db548b86b",
    "mirror.test.ts": "bc896c1bad858de96cddc4ed4807eb0955ef66ba3ea9d8037033afb2b182e204",
    "onegrinders.ts": "c1ac919597ad179019e80569740741f5e858408790b04a782726b26f15bf15e4",
    "provision.ts": "c9c83f011bd515442d138c2921bcb33d3593ac7e76ffe1116abd95db84d21e06",
    "rebuild-mirror.mjs": "fa65e230152ec822bfd8cbd2a91c4afde4cfe7d94aa8564cf472663df850de6c",
    "resolve.test.ts": "619471d21c5093c78f5dc7a295a3ff2eefd11f37feb3986bcda5e7b5d6e7b215",
    "resolve.ts": "6c2004015ef7c5051f89b80f2bb142f51a660f4d756a68ab661729096ab7d9a3",
    "support.test.ts": "4f9629c93d4e68cf741bc1b42906be22e3e543ab2fcac807f9130a82c6b7dd9b",
    "support.ts": "3d2086e03726a165a5f84d39f241e70a1da40265ace1af4f9bcaa81579b004f1",
  } as Record<string, string>,
};
