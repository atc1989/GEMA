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
  version: "700a74450f051ddc",
  files: {
    "README.md": "7eddaec5df26a4a9d2de6a04c02682839944d973d5e238390fcfeb09074ec06b",
    "client.ts": "aaebfe4f227c871a70d6ec391c38c049d0daf419904ded841665a43c62715817",
    "email-code.ts": "96d83d1624d7c2ebfc11fd79cb3976e0bf8e6d718ba00e122178dc8b1c6819b1",
    "identity-client.ts": "3b9854bf63dfc39c7eb3541e04c4e17132c5def70b98b7c80401afd63abde826",
    "index.ts": "2d267c7b0715cfac1a06527f3b2aa49d8fc209f94e3ba18597cc51eb884e211a",
    "login-engine.ts": "3043fb0030d2a21cbfe4d36d3af0c1e7bea0e3603b2d58ae3e84b77db548b86b",
    "mirror.test.ts": "bc896c1bad858de96cddc4ed4807eb0955ef66ba3ea9d8037033afb2b182e204",
    "onegrinders.ts": "24d009f0ad5493e62204d54e5f047dc36ca633c7a99698eeb40cb9bde5a92881",
    "person-admin.ts": "264bfbae2ac0198814d9cb61254816484e84f7f98b69c00812333bb35c31f924",
    "person.test.ts": "bf62ace95802825f1c7946e0e415c79cf0a79bccb0d894f63d443fff1942cedc",
    "person.ts": "d8141dc5e40c5157604aba21583b2e3dd6c22335c136730a72aa667c0644c197",
    "provision.ts": "4aa8a77758846d566becc283f43cc752ce06480f653a9d5a3236d4a686725d36",
    "rebuild-mirror.mjs": "fa65e230152ec822bfd8cbd2a91c4afde4cfe7d94aa8564cf472663df850de6c",
    "resolve.test.ts": "f9419d7111afab00a83d7198db42cafa96d4c66779ccab46198355b93e714641",
    "resolve.ts": "86703997e67e853dee623430e039a4fdd3ff9dd9c8e36bfcc37ce50a2ab376d0",
    "support.test.ts": "26e798b95d9c4d141605087bb5b8efd09223092df2e892a0ec2bbf0fbb1bde17",
    "support.ts": "09fb421383730c434d99c58c30d8307f17375f388ffd64f21a73de1fec9857f9",
  } as Record<string, string>,
};
