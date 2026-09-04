import assert from "node:assert/strict";
import test from "node:test";

import {
  isFrameworkControlFlow,
  isMissingTable,
  looksLikeEmail,
  normalizeIdentifier,
} from "./support.ts";
import {
  externalEmailForUsername,
  looksLikeKeyRejection,
  externalFullName,
  isSyntheticExternalEmail,
  memberCodeForExternalUser,
  normalizeUsername,
  profilePhotoUrl,
} from "./onegrinders.ts";

test("one field routes to OneGrinders or to the email password", () => {
  assert.equal(looksLikeEmail("najee@gutguard.ph"), true);
  assert.equal(looksLikeEmail("najee"), false);
  assert.equal(looksLikeEmail("one.grinder_99"), false);
});

test("identifiers match regardless of case or stray spacing", () => {
  assert.equal(normalizeIdentifier("  NaJee  "), "najee");
  assert.equal(normalizeIdentifier("Najee@GutGuard.PH"), "najee@gutguard.ph");
});

test("a username maps to the same synthetic email on every app", () => {
  assert.equal(externalEmailForUsername("NaJee"), "najee@onegrindersguild.local");
  // Anything outside the safe set becomes a dash, so the address stays valid.
  assert.equal(externalEmailForUsername("na jee!"), "na-jee-@onegrindersguild.local");
  assert.equal(isSyntheticExternalEmail("najee@onegrindersguild.local"), true);
  assert.equal(isSyntheticExternalEmail("najee@gutguard.ph"), false);
});

test("synthetic addresses are not offered a reset link", () => {
  // They cannot receive mail, so the reset flow must refuse them.
  assert.equal(isSyntheticExternalEmail(externalEmailForUsername("najee")), true);
});

test("member codes are stable and padded", () => {
  assert.equal(memberCodeForExternalUser(42), "OGG-000042");
});

test("name parts win over a drifted full_name column", () => {
  const account = {
    user: { username: "najee" },
    profile: {
      first_name: "Najee",
      middle_name: null,
      last_name: "Reyes",
      full_name: "Someone Else",
      display_name: null,
    },
  } as unknown as Parameters<typeof externalFullName>[0];
  assert.equal(externalFullName(account), "Najee Reyes");
});

test("full_name is the fallback when the parts are empty", () => {
  const account = {
    user: { username: "najee" },
    profile: {
      first_name: null,
      middle_name: null,
      last_name: null,
      full_name: "Najee Reyes",
      display_name: null,
    },
  } as unknown as Parameters<typeof externalFullName>[0];
  assert.equal(externalFullName(account), "Najee Reyes");
});

test("relative avatar paths resolve against the guild host", () => {
  assert.equal(profilePhotoUrl(null), null);
  assert.equal(
    profilePhotoUrl("/uploads/a.jpg"),
    "https://onegrindersguild.ph/uploads/a.jpg",
  );
  assert.equal(profilePhotoUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
});

test("usernames are compared lowercase and trimmed", () => {
  assert.equal(normalizeUsername("  NaJee "), "najee");
});

test("a 401 about the API key is not read as a bad member password", () => {
  // Getting this wrong revokes a real member's mirrored password.
  assert.equal(looksLikeKeyRejection("Invalid API key"), true);
  assert.equal(looksLikeKeyRejection("Missing X-API-Key header"), true);
  assert.equal(looksLikeKeyRejection("Forbidden"), true);
  assert.equal(looksLikeKeyRejection("Invalid token"), true);
  assert.equal(looksLikeKeyRejection("Invalid username or password."), false);
  assert.equal(looksLikeKeyRejection("Wrong password"), false);
  assert.equal(looksLikeKeyRejection(undefined), false);
});

test("a missing identity table degrades instead of failing the login", () => {
  assert.equal(isMissingTable({ code: "PGRST205" }), true);
  assert.equal(isMissingTable({ code: "42P01" }), true);
  assert.equal(
    isMissingTable({ message: "Could not find the table 'gema.members' in the schema cache" }),
    true,
  );
  assert.equal(isMissingTable({ code: "23505", message: "duplicate key value" }), false);
  assert.equal(isMissingTable(null), false);
});

test("Next's own control flow is not swallowed as an error", () => {
  // A first-visit helper wraps everything in try/catch so a database problem
  // cannot cost a page render. These are not database problems: catching the
  // dynamic-rendering bail-out would let a member surface be prerendered.
  assert.equal(isFrameworkControlFlow({ digest: "DYNAMIC_SERVER_USAGE" }), true);
  assert.equal(isFrameworkControlFlow({ digest: "NEXT_REDIRECT;replace;/card;307;" }), true);
  assert.equal(isFrameworkControlFlow({ name: "DynamicServerError" }), true);
  assert.equal(isFrameworkControlFlow(new Error("permission denied")), false);
  assert.equal(isFrameworkControlFlow(null), false);
  assert.equal(isFrameworkControlFlow("boom"), false);
});
