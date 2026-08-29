import assert from "node:assert/strict";
import test from "node:test";

import { EMAIL_CODE_COPY } from "./email-code.ts";
import { ExternalLoginError } from "./onegrinders.ts";
import {
  BACKUP_NO_ACCOUNT,
  BACKUP_WRONG_PASSWORD,
  ONEGRINDERS_PRODUCT_WRITES,
  resolveLogin,
  THROTTLE_WINDOW_MINUTES,
  type LoginPorts,
} from "./resolve.ts";

/**
 * The order of operations is the whole point of the engine: throttle before
 * anything, the local mirror before the slow guild API, the mirrored password
 * when that API is down. These fakes assert that order without a live project.
 */
function ports(overrides: Partial<LoginPorts> = {}): LoginPorts {
  return {
    isThrottled: async () => false,
    recordFailedLogin: async () => undefined,
    emailForUsername: async () => null,
    signInWithPassword: async () => ({ ok: false }),
    provisionOneGrinders: async () => {
      throw new ExternalLoginError("not used", "remote");
    },
    syncInBackground: () => undefined,
    ...overrides,
  };
}

test("an email skips OneGrinders entirely", async () => {
  const calls: string[] = [];
  const result = await resolveLogin(
    "Ana@Gutguard.ph",
    "Secret1",
    ports({
      emailForUsername: async () => {
        calls.push("lookup");
        return null;
      },
      provisionOneGrinders: async () => {
        calls.push("provision");
        return { email: "x", password: "y" };
      },
      signInWithPassword: async () => ({ ok: true, userId: "user-1" }),
    }),
  );

  assert.deepEqual(calls, []);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.usedUsername, false);
    assert.equal(result.backupLogin, false);
    assert.equal(result.userId, "user-1");
    // The address is passed through as typed, not lowercased.
    assert.equal(result.email, "Ana@Gutguard.ph");
  }
});

test("a username signs in on the local mirror without waiting on the API", async () => {
  let provisioned = false;
  const synced: Array<[string, string]> = [];
  const result = await resolveLogin(
    "JohnDoe",
    "Secret1",
    ports({
      emailForUsername: async () => "johndoe@onegrindersguild.local",
      signInWithPassword: async () => ({ ok: true, userId: "user-2" }),
      provisionOneGrinders: async () => {
        provisioned = true;
        return { email: "x", password: "y" };
      },
      syncInBackground: (username, password) => {
        synced.push([username, password]);
      },
    }),
  );

  assert.equal(provisioned, false, "the slow guild API must stay off the fast path");
  assert.deepEqual(synced, [["johndoe", "Secret1"]], "re-verification is still scheduled");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.usedUsername, true);
    assert.equal(result.userId, "user-2");
  }
});

test("a stale mirror password falls through to full verification", async () => {
  let attempts = 0;
  const result = await resolveLogin(
    "johndoe",
    "NewPass1",
    ports({
      emailForUsername: async () => "johndoe@onegrindersguild.local",
      signInWithPassword: async () => {
        attempts += 1;
        // The mirrored password is stale, the re-provisioned one works.
        return attempts === 1 ? { ok: false } : { ok: true, userId: "user-3" };
      },
      provisionOneGrinders: async () => ({
        email: "johndoe@onegrindersguild.local",
        password: "NewPass1",
      }),
    }),
  );

  assert.equal(attempts, 2);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.backupLogin, false);
});

test("a guild outage signs in on the mirrored backup password", async () => {
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      emailForUsername: async () => "johndoe@onegrindersguild.local",
      signInWithPassword: async (_email, password) =>
        password === "Secret1" ? { ok: false } : { ok: true, userId: "user-4" },
      provisionOneGrinders: async () => {
        throw new ExternalLoginError("down", "remote");
      },
    }),
  );

  // Same password, second attempt: the mirror is tried again as the backup.
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, BACKUP_WRONG_PASSWORD);
});

test("a guild outage with a working mirror password lands as a backup login", async () => {
  let attempts = 0;
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      emailForUsername: async () => "johndoe@onegrindersguild.local",
      signInWithPassword: async () => {
        attempts += 1;
        return attempts === 1 ? { ok: false } : { ok: true, userId: "user-5" };
      },
      provisionOneGrinders: async () => {
        throw new ExternalLoginError("down", "remote");
      },
    }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.backupLogin, true, "the app shows the backup-access banner");
    assert.equal(result.userId, "user-5");
  }
});

test("a guild outage with no local member is a calm new-member message", async () => {
  const result = await resolveLogin(
    "newbie",
    "Secret1",
    ports({
      provisionOneGrinders: async () => {
        throw new ExternalLoginError("down", "remote");
      },
    }),
  );
  assert.deepEqual(result, { ok: false, error: BACKUP_NO_ACCOUNT });
});

test("bad guild credentials are recorded and surfaced", async () => {
  const recorded: string[] = [];
  const result = await resolveLogin(
    "JohnDoe",
    "wrong",
    ports({
      recordFailedLogin: async (id) => {
        recorded.push(id);
      },
      provisionOneGrinders: async () => {
        throw new ExternalLoginError("Invalid username or password.", "credentials");
      },
    }),
  );

  assert.deepEqual(recorded, ["johndoe"], "the throttle counts the normalised identifier");
  assert.deepEqual(result, { ok: false, error: "Invalid username or password." });
});

test("a deactivated guild account is refused, not provisioned", async () => {
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      provisionOneGrinders: async () => {
        throw new ExternalLoginError("This external account is not active.", "credentials");
      },
    }),
  );
  assert.deepEqual(result, { ok: false, error: "This external account is not active." });
});

test("a missing ONEGRINDERS_API_KEY says so instead of failing quietly", async () => {
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      provisionOneGrinders: async () => {
        throw new ExternalLoginError(
          "External login is not configured. Add ONEGRINDERS_API_KEY on the server.",
          "configuration",
        );
      },
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /ONEGRINDERS_API_KEY/);
});

test("an unexpected throw is not leaked to the member", async () => {
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      provisionOneGrinders: async () => {
        throw new TypeError("fetch is not a function");
      },
    }),
  );
  assert.deepEqual(result, { ok: false, error: "Unable to verify this login right now." });
});

test("the throttle blocks before the guild API is called", async () => {
  let provisioned = false;
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      isThrottled: async () => true,
      provisionOneGrinders: async () => {
        provisioned = true;
        return { email: "x", password: "y" };
      },
    }),
  );

  assert.equal(provisioned, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, new RegExp(String(THROTTLE_WINDOW_MINUTES)));
});

test("a wrong email password is recorded and refused", async () => {
  const recorded: string[] = [];
  const result = await resolveLogin(
    "ana@gutguard.ph",
    "wrong",
    ports({
      recordFailedLogin: async (id) => {
        recorded.push(id);
      },
    }),
  );
  assert.deepEqual(recorded, ["ana@gutguard.ph"]);
  assert.deepEqual(result, { ok: false, error: "Invalid email or password." });
});

test("blank fields are refused before any port is touched", async () => {
  let touched = false;
  const watching = ports({
    isThrottled: async () => {
      touched = true;
      return false;
    },
  });

  assert.deepEqual(await resolveLogin("   ", "Secret1", watching), {
    ok: false,
    error: "Username or email is required.",
  });
  assert.deepEqual(await resolveLogin("johndoe", "", watching), {
    ok: false,
    error: "Password is required.",
  });
  assert.equal(touched, false);
});

test("an unconfirmed address is offered the code step, not a wrong-password message", async () => {
  const recorded: string[] = [];
  const result = await resolveLogin(
    "ana@gutguard.ph",
    "Secret1",
    ports({
      recordFailedLogin: async (id) => {
        recorded.push(id);
      },
      signInWithPassword: async () => ({ ok: false, message: "Email not confirmed" }),
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, EMAIL_CODE_COPY);
    assert.equal(result.needsEmailConfirm, true);
  }
  assert.deepEqual(recorded, [], "confirming an email must not burn the throttle");
});

test("a username is never sent to the email code step", async () => {
  // A guild account has no confirmable address; the message would be a dead end.
  const result = await resolveLogin(
    "johndoe",
    "Secret1",
    ports({
      emailForUsername: async () => "johndoe@onegrindersguild.local",
      signInWithPassword: async () => ({ ok: false, message: "Email not confirmed" }),
      provisionOneGrinders: async () => ({
        email: "johndoe@onegrindersguild.local",
        password: "Secret1",
      }),
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.needsEmailConfirm, undefined);
    assert.equal(result.error, "Invalid email or password.");
  }
});

test("the provisioner's remit stays the identity spine", () => {
  // Change 4 owns Academy BASE rows and Lifestyle cards, not this engine.
  assert.deepEqual(ONEGRINDERS_PRODUCT_WRITES, ["profiles", "members"]);
});
