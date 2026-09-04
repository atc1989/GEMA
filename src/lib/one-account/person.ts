import { identitySchema, isMissingColumn, isMissingTable } from "./support.ts";

/**
 * The person row, on both sides of the spine — the decision half.
 *
 * `00 - Locks`: one `auth.users.id` is one person row, and a new Auth user
 * creates a person ONLY — never a Lifestyle card, never an Academy BASE row.
 * Change 3 put the person in two places at the same id: `public.profiles`, which
 * the spokes read, and `gema.profiles`, which the GEMA app reads. An account can
 * be created on any of the three apps now, so no app may assume its own signup
 * wrote the row it needs.
 *
 * Without this the failure is silent and circular: GEMA's landing finds no
 * profile and no member and sends the member to /onboarding, which finds no
 * profile and sends them back to /login. A valid session and the login page,
 * forever, with no error anywhere.
 *
 * This file writes those two rows and nothing else. The card and the trainee row
 * are lazy, created on first visit to that spoke, and belong to that app
 * (Change 4). `person-admin.ts` is the wiring; everything here runs on an
 * injected client so it can be tested without a live project.
 */

/** The schema holding the person row the spokes read. */
export const PERSON_SCHEMA = "public";

export type PersonIdentity = {
  id: string;
  email: string | null;
  fullName: string;
};

export type PersonRowOutcome = "created" | "present" | "absent-table" | "failed" | "skipped";

export type EnsurePersonResult = {
  /** `public.profiles` — what Lifestyle and Academy read. */
  person: PersonRowOutcome;
  /** The identity spine schema (`gema` by default) — what GEMA reads. */
  spine: PersonRowOutcome;
  identity: PersonIdentity | null;
};

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * A person with a blank name renders as nobody, so the name falls back through
 * everything the account actually knows before giving up. `username` is in here
 * because a OneGrinders member arrives with a guild username and little else —
 * that is the name their Lifestyle card is built from (D13).
 */
export function personNameFrom(input: {
  metadata?: Record<string, unknown> | null;
  email?: string | null;
  fullName?: string | null;
}): string {
  const meta = input.metadata ?? {};
  return (
    trimmed(input.fullName) ??
    trimmed(meta.full_name) ??
    trimmed(meta.name) ??
    trimmed(meta.username) ??
    trimmed(input.email?.split("@")[0]) ??
    "member"
  );
}

/**
 * Insert payloads from widest to narrowest. The three apps do not share one
 * `profiles` shape: `gema.profiles` has no `account_status`, and a database
 * without Change 3 has no `full_name` on the Lifestyle card table. Narrowing on
 * a missing-column error is how one module writes all of them without a per-app
 * column list that goes stale the moment a migration lands.
 */
export function personRowVariants(identity: PersonIdentity): Record<string, unknown>[] {
  return [
    {
      id: identity.id,
      full_name: identity.fullName,
      email: identity.email,
      account_status: "active",
    },
    { id: identity.id, full_name: identity.fullName, email: identity.email },
    { id: identity.id, full_name: identity.fullName },
  ];
}

/** The slice of a Supabase client this file uses, so tests can pass a fake. */
export type PersonClient = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle<T>(): PromiseLike<{
          data: T | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
    insert(row: Record<string, unknown>): PromiseLike<{
      error: { code?: string; message?: string } | null;
    }>;
  };
};

export async function writePersonRow(
  client: PersonClient,
  identity: PersonIdentity,
): Promise<PersonRowOutcome> {
  const { data: existing, error: readError } = await client
    .from("profiles")
    .select("id")
    .eq("id", identity.id)
    .maybeSingle<{ id: string }>();

  if (readError && isMissingTable(readError)) return "absent-table";
  if (readError) return "failed";
  if (existing) return "present";

  let lastError: { code?: string; message?: string } | null = null;
  for (const row of personRowVariants(identity)) {
    const { error } = await client.from("profiles").insert(row);
    if (!error) return "created";
    // 23505: someone else created this person between the read and the write.
    // That is the outcome we wanted, not a failure.
    if (error.code === "23505") return "present";
    if (isMissingTable(error)) return "absent-table";
    lastError = error;
    if (!isMissingColumn(error)) break;
  }

  console.warn("[one-account] could not create the person row", {
    userId: identity.id,
    code: lastError?.code,
    message: lastError?.message,
  });
  return "failed";
}

export type PersonPorts = {
  /** The person, as the Auth record knows them. `null` means: do nothing. */
  readIdentity: () => Promise<PersonIdentity | null>;
  clientFor: (schema: string) => PersonClient;
};

export const PERSON_SKIPPED: EnsurePersonResult = {
  person: "skipped",
  spine: "skipped",
  identity: null,
};

/**
 * Never throws and never blocks a login: a missing row costs a trip through
 * onboarding, a thrown error costs the session.
 */
export async function ensurePersonRowWith(ports: PersonPorts): Promise<EnsurePersonResult> {
  try {
    const identity = await ports.readIdentity();
    if (!identity) return PERSON_SKIPPED;

    const spineSchema = identitySchema();
    const person = await writePersonRow(ports.clientFor(PERSON_SCHEMA), identity);
    const spine =
      spineSchema === PERSON_SCHEMA
        ? person
        : await writePersonRow(ports.clientFor(spineSchema), identity);

    return { person, spine, identity };
  } catch (error) {
    console.warn("[one-account] person row check skipped", {
      message: error instanceof Error ? error.message : String(error),
    });
    return PERSON_SKIPPED;
  }
}
