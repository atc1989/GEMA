import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The guards must never turn a failed auth check into a sign-out.
 *
 * `getClaims()` refreshes the token and fetches signing keys over the network,
 * so it fails for reasons that have nothing to do with being signed out. When
 * that failure redirected to /login it *created* the sign-out: the member
 * arrived holding a good session and left without one.
 *
 * These modules import the Supabase server client and next/navigation, so there
 * is nothing to execute under bare `node --test` — same constraint as
 * middleware.test.ts. What can be pinned is the property that broke: in every
 * guard, the `checkFailed` throw comes before the redirect. A fifth guard added
 * without it fails here.
 */
const read = (file: string) => readFileSync(join(import.meta.dirname, file), "utf8");
const admin = read("require-admin.ts");
const member = read("require-member.ts");

/** The body of `export async function NAME(...)` up to the next top-level export. */
function guardBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} is gone — this test is now testing nothing`);
  const rest = source.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  return end === -1 ? rest : rest.slice(0, end);
}

for (const [name, source] of [
  ["requireAdmin", admin],
  ["requireEventManager", admin],
  ["requireMember", member],
] as const) {
  test(`${name} throws on a failed check before it can redirect`, () => {
    const body = guardBody(source, name);

    const thrown = body.indexOf("throw new AuthCheckFailedError()");
    const redirected = body.indexOf("redirect(");

    assert.notEqual(thrown, -1, `${name} redirects without distinguishing a failed check`);
    assert.notEqual(redirected, -1, `${name} no longer redirects — is the guard still a guard?`);
    assert.ok(
      thrown < redirected,
      `${name} redirects before checking checkFailed, so a failed check still signs people out`,
    );
    assert.match(body, /checkFailed/, `${name} never reads checkFailed`);
  });
}

test("requireMember guards both queries — the profile and the member row", () => {
  const body = guardBody(member, "requireMember");
  // Two separate failures: getAuthState() and the members query. Sending a real
  // member to /onboarding is the same mistake as /login, one table further down.
  assert.equal([...body.matchAll(/throw new AuthCheckFailedError\(\)/g)].length, 2);
});

test("getCurrentProfile stays a thin read of getAuthState", () => {
  // The public pages depend on null meaning "anonymous". If this grows its own
  // getClaims() call again, the two failures are indistinguishable once more.
  assert.match(admin, /getCurrentProfile[\s\S]{0,160}\(await getAuthState\(\)\)\.profile/);
  assert.equal([...admin.matchAll(/auth\.getClaims\(\)/g)].length, 1);
});

test("getCurrentMember stays a thin read of getMemberState", () => {
  assert.match(member, /getCurrentMember[\s\S]{0,160}\(await getMemberState\(\)\)\.context/);
});
