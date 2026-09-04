import assert from "node:assert/strict";
import test from "node:test";

import {
  ensurePersonRowWith,
  personNameFrom,
  personRowVariants,
  writePersonRow,
  PERSON_SCHEMA,
  type PersonClient,
  type PersonIdentity,
} from "./person.ts";

/**
 * The person row is written by all three apps against three different
 * `profiles` shapes. These fakes pin the two behaviours that make that safe:
 * narrowing the payload when a column is not on that table, and never turning a
 * database problem into a failed sign-in.
 */

const ANA: PersonIdentity = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ana@gutguard.ph",
  fullName: "Ana Reyes",
};

type Recorded = { schema: string; row: Record<string, unknown> };

function fakeClient(options: {
  schema?: string;
  existing?: boolean;
  readError?: { code?: string; message?: string };
  /** Errors returned per insert attempt, in order. */
  insertErrors?: (({ code?: string; message?: string }) | null)[];
  recorded?: Recorded[];
}): PersonClient {
  let attempt = 0;
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle<T>() {
                  if (options.readError) return { data: null, error: options.readError };
                  return {
                    data: (options.existing ? ({ id: ANA.id } as unknown as T) : null),
                    error: null,
                  };
                },
              };
            },
          };
        },
        async insert(row: Record<string, unknown>) {
          const error = options.insertErrors?.[attempt] ?? null;
          attempt += 1;
          if (!error) {
            options.recorded?.push({ schema: options.schema ?? PERSON_SCHEMA, row });
          }
          return { error };
        },
      };
    },
  };
}

test("the guild username is a name when the account has nothing else", () => {
  assert.equal(
    personNameFrom({ metadata: { username: "TEST_MANCERA" }, email: null }),
    "TEST_MANCERA",
  );
  assert.equal(
    personNameFrom({ metadata: { full_name: "  Ana Reyes " }, email: "ana@gutguard.ph" }),
    "Ana Reyes",
  );
  assert.equal(personNameFrom({ metadata: {}, email: "jun@gutguard.ph" }), "jun");
  assert.equal(personNameFrom({ metadata: null, email: null }), "member");
  // An explicit name from the register form beats anything on the auth record.
  assert.equal(
    personNameFrom({ metadata: { full_name: "Old" }, email: null, fullName: "New" }),
    "New",
  );
});

test("the widest payload is tried first, and it is a person — never a card", () => {
  const [widest] = personRowVariants(ANA);
  assert.deepEqual(widest, {
    id: ANA.id,
    full_name: "Ana Reyes",
    email: "ana@gutguard.ph",
    account_status: "active",
  });
  for (const variant of personRowVariants(ANA)) {
    for (const card of ["card_no", "points", "phase", "claimed", "member_card", "role"]) {
      assert.equal(card in variant, false, `${card} must not be on a person row`);
    }
  }
});

test("a missing column narrows the payload instead of failing the visit", async () => {
  const recorded: Recorded[] = [];
  const outcome = await writePersonRow(
    fakeClient({
      insertErrors: [
        { code: "PGRST204", message: "Could not find the 'account_status' column" },
        null,
      ],
      recorded,
    }),
    ANA,
  );
  assert.equal(outcome, "created");
  assert.deepEqual(recorded[0]?.row, {
    id: ANA.id,
    full_name: "Ana Reyes",
    email: "ana@gutguard.ph",
  });
});

test("an error that is not a missing column stops, it does not try narrower rows", async () => {
  const recorded: Recorded[] = [];
  const outcome = await writePersonRow(
    fakeClient({
      insertErrors: [{ code: "42501", message: "permission denied for table profiles" }],
      recorded,
    }),
    ANA,
  );
  assert.equal(outcome, "failed");
  assert.equal(recorded.length, 0);
});

test("a person who already exists is left alone, and a duplicate race is not a failure", async () => {
  assert.equal(await writePersonRow(fakeClient({ existing: true }), ANA), "present");
  assert.equal(
    await writePersonRow(fakeClient({ insertErrors: [{ code: "23505" }] }), ANA),
    "present",
  );
});

test("a spoke without the table degrades instead of 500ing", async () => {
  assert.equal(
    await writePersonRow(
      fakeClient({ readError: { code: "PGRST205", message: "could not find the table" } }),
      ANA,
    ),
    "absent-table",
  );
});

test("both sides of the spine are written, at the same id", async () => {
  const recorded: Recorded[] = [];
  const result = await ensurePersonRowWith({
    readIdentity: async () => ANA,
    clientFor: (schema) => fakeClient({ schema, recorded }),
  });
  assert.equal(result.person, "created");
  assert.equal(result.spine, "created");
  assert.deepEqual(
    recorded.map((entry) => entry.schema).sort(),
    ["gema", "public"],
  );
  assert.equal(new Set(recorded.map((entry) => entry.row.id)).size, 1);
});

test("no identity means no write at all", async () => {
  const recorded: Recorded[] = [];
  const result = await ensurePersonRowWith({
    readIdentity: async () => null,
    clientFor: (schema) => fakeClient({ schema, recorded }),
  });
  assert.deepEqual(result, { person: "skipped", spine: "skipped", identity: null });
  assert.equal(recorded.length, 0);
});

test("a thrown port is swallowed — a sign-in must not die on this", async () => {
  const result = await ensurePersonRowWith({
    readIdentity: async () => {
      throw new Error("service role key rejected");
    },
    clientFor: () => fakeClient({}),
  });
  assert.equal(result.person, "skipped");
});
