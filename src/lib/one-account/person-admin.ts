import "server-only";

import {
  createIdentityAdminClient,
  hasIdentityAdminCredentials,
} from "./identity-client.ts";
import {
  ensurePersonRowWith,
  personNameFrom,
  PERSON_SKIPPED,
  type EnsurePersonResult,
  type PersonClient,
  type PersonIdentity,
} from "./person.ts";
import { identitySchema } from "./support.ts";

/**
 * Wiring for `person.ts`: the service-role clients and the Auth lookup. Called
 * after a successful sign-in on any of the three apps, and before any lazy
 * product row is written — a card or a trainee row without a person behind it
 * is the thing `00 - Locks` forbids.
 */
export async function ensurePersonRow(
  userId: string | null,
  overrides?: { fullName?: string | null; email?: string | null },
): Promise<EnsurePersonResult> {
  if (!userId) return PERSON_SKIPPED;
  if (!hasIdentityAdminCredentials()) return PERSON_SKIPPED;

  return ensurePersonRowWith({
    readIdentity: () => readIdentity(userId, overrides),
    clientFor: (schema) => createIdentityAdminClient(schema) as unknown as PersonClient,
  });
}

async function readIdentity(
  userId: string,
  overrides?: { fullName?: string | null; email?: string | null },
): Promise<PersonIdentity | null> {
  const admin = createIdentityAdminClient(identitySchema());
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = error ? null : data?.user;
  if (!user && !overrides?.email) return null;

  const email = overrides?.email ?? user?.email ?? null;
  return {
    id: userId,
    email,
    fullName: personNameFrom({
      metadata: (user?.user_metadata ?? null) as Record<string, unknown> | null,
      email,
      fullName: overrides?.fullName ?? null,
    }),
  };
}
