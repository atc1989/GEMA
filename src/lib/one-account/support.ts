/**
 * Pure helpers shared by the login engine. No Supabase, no Next, no
 * `server-only` — so they can be unit tested in plain Node.
 */

/**
 * The Postgres schema that holds the identity spine (`profiles`, `members`,
 * `login_attempts`). GEMA clients pin `gema`; identity moves to `public` in
 * Change 3, so the name is configurable rather than hard-coded at call sites.
 */
export function identitySchema() {
  return process.env.ONE_ACCOUNT_IDENTITY_SCHEMA ?? "gema";
}

/**
 * One field, two credentials (`04 - UX`): an `@` means a Supabase email
 * password, anything else is a OneGrinders username.
 */
export function looksLikeEmail(identifier: string) {
  return identifier.includes("@");
}

/** Throttle counters and username lookups are case-insensitive. */
export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

/**
 * True when a PostgREST error means "this table is not installed here" rather
 * than "this query failed". A spoke can share Staging Auth before the identity
 * tables exist alongside it; a missing table must degrade, not 500.
 */
export function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // PGRST205: table not found in schema cache. 42P01: undefined_table.
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("could not find the table");
}

/**
 * True when a PostgREST error means "this column is not on that table here"
 * rather than "this query failed". The three apps do not share one
 * `profiles` shape yet — Academy's own project has no `account_status`, and a
 * database without Change 3 has no `full_name` — so a person write has to be
 * able to narrow its payload instead of failing the visit.
 */
export function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // PGRST204: column not found in schema cache. 42703: undefined_column.
  if (error.code === "PGRST204" || error.code === "42703") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("column") && message.includes("does not exist");
}
