export {
  createLoginEngine,
  THROTTLED_MESSAGE,
  type LoginEngineOptions,
  type LoginOutcome,
  type SessionClient,
} from "./login-engine.ts";

export {
  createIdentityAdminClient,
  hasIdentityAdminCredentials,
  type IdentityAdminClient,
} from "./identity-client.ts";

export { ensurePersonRow } from "./person-admin.ts";

export {
  ensurePersonRowWith,
  personNameFrom,
  personRowVariants,
  writePersonRow,
  PERSON_SCHEMA,
  type EnsurePersonResult,
  type PersonClient,
  type PersonIdentity,
  type PersonPorts,
  type PersonRowOutcome,
} from "./person.ts";

export {
  emailForUsername,
  provisionOneGrindersLogin,
  syncExternalLoginInBackground,
} from "./provision.ts";

export {
  ExternalLoginError,
  externalEmailForUsername,
  isSyntheticExternalEmail,
  normalizeUsername,
  type ExternalLoginProvisionResult,
} from "./onegrinders.ts";

export {
  identitySchema,
  isFrameworkControlFlow,
  isMissingColumn,
  isMissingTable,
  looksLikeEmail,
  normalizeIdentifier,
} from "./support.ts";

export {
  EMAIL_CODE_COPY,
  EMAIL_CODE_HINT,
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_RESENT,
  isCompleteEmailCode,
  isEmailUnconfirmedMessage,
  normalizeEmailCode,
} from "./email-code.ts";
