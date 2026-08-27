import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_NO_ACCOUNT,
  BACKUP_WRONG_PASSWORD,
  ONEGRINDERS_PRODUCT_WRITES,
  looksLikeEmail,
  normalizeIdentifier,
  passwordSignInError,
  resolveSharedLogin,
  SharedLoginError,
  THROTTLE_WINDOW_MINUTES,
  type LoginPorts,
} from "./login-engine.ts";

function ports(overrides: Partial<LoginPorts> = {}): LoginPorts {
  return {
    isThrottled: async () => false,
    recordFailedLogin: async () => undefined,
    lookupEmailByUsername: async () => null,
    signInWithPassword: async () => false,
    provisionOneGrinders: async () => {
      throw new SharedLoginError("not used", "remote");
    },
    ...overrides,
  };
}

test("email identifiers skip OneGrinders", async () => {
  const calls: string[] = [];
  const result = await resolveSharedLogin("Ana@Gutguard.ph", "Secret1", ports({
    provisionOneGrinders: async () => {
      calls.push("provision");
      return { email: "x", password: "y" };
    },
    lookupEmailByUsername: async () => {
      calls.push("lookup");
      return null;
    },
  }));
  assert.deepEqual(calls, []);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.phase, "password");
    if (result.phase === "password") {
      assert.equal(result.email, "Ana@Gutguard.ph");
      assert.equal(result.backupLogin, false);
    }
  }
});

test("username local-first signs in without waiting on the API", async () => {
  let provisioned = false;
  const result = await resolveSharedLogin("johndoe", "Secret1", ports({
    lookupEmailByUsername: async () => "johndoe@onegrindersguild.local",
    signInWithPassword: async () => true,
    provisionOneGrinders: async () => {
      provisioned = true;
      return { email: "x", password: "y" };
    },
  }));
  assert.equal(provisioned, false);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.phase, "session");
    assert.deepEqual(result.backgroundSync, { username: "johndoe", password: "Secret1" });
  }
});

test("username falls through to provision when the mirror password is stale", async () => {
  const result = await resolveSharedLogin("johndoe", "NewPass1", ports({
    lookupEmailByUsername: async () => "johndoe@onegrindersguild.local",
    signInWithPassword: async () => false,
    provisionOneGrinders: async () => ({
      email: "johndoe@onegrindersguild.local",
      password: "NewPass1",
    }),
  }));
  assert.equal(result.ok, true);
  if (result.ok && result.phase === "password") {
    assert.equal(result.email, "johndoe@onegrindersguild.local");
  }
});

test("remote OneGrinders outage uses the mirrored backup account", async () => {
  const result = await resolveSharedLogin("johndoe", "Secret1", ports({
    lookupEmailByUsername: async () => "johndoe@onegrindersguild.local",
    signInWithPassword: async () => false,
    provisionOneGrinders: async () => {
      throw new SharedLoginError("down", "remote");
    },
  }));
  assert.equal(result.ok, true);
  if (result.ok && result.phase === "password") {
    assert.equal(result.backupLogin, true);
    assert.equal(result.email, "johndoe@onegrindersguild.local");
  }
});

test("remote outage with no local member is a calm new-member message", async () => {
  const result = await resolveSharedLogin("newbie", "Secret1", ports({
    provisionOneGrinders: async () => {
      throw new SharedLoginError("down", "remote");
    },
  }));
  assert.deepEqual(result, { ok: false, error: BACKUP_NO_ACCOUNT });
});

test("bad OneGrinders credentials are recorded and returned", async () => {
  const recorded: string[] = [];
  const result = await resolveSharedLogin("johndoe", "wrong", ports({
    recordFailedLogin: async (id) => {
      recorded.push(id);
    },
    provisionOneGrinders: async () => {
      throw new SharedLoginError("Invalid username or password.", "credentials");
    },
  }));
  assert.deepEqual(recorded, ["johndoe"]);
  assert.deepEqual(result, { ok: false, error: "Invalid username or password." });
});

test("throttle blocks before OneGrinders", async () => {
  let provisioned = false;
  const result = await resolveSharedLogin("johndoe", "Secret1", ports({
    isThrottled: async () => true,
    provisionOneGrinders: async () => {
      provisioned = true;
      return { email: "x", password: "y" };
    },
  }));
  assert.equal(provisioned, false);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, new RegExp(String(THROTTLE_WINDOW_MINUTES)));
  }
});

test("helpers", () => {
  assert.equal(looksLikeEmail("ana@gutguard.ph"), true);
  assert.equal(looksLikeEmail("johndoe"), false);
  assert.equal(normalizeIdentifier(" Jane.Doe "), "jane.doe");
  assert.equal(passwordSignInError(true), BACKUP_WRONG_PASSWORD);
  assert.equal(passwordSignInError(false), "Invalid email or password.");
  assert.deepEqual(ONEGRINDERS_PRODUCT_WRITES, ["gema.profiles", "gema.members"]);
});
