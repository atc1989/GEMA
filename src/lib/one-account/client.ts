/**
 * Browser-safe half of the module. `index.ts` re-exports the engine and the
 * provisioner, which are `server-only` — importing it from a client component
 * fails the build. Login forms import this instead: shared copy and pure
 * helpers, no Supabase, no service role.
 */

export {
  EMAIL_CODE_COPY,
  EMAIL_CODE_HINT,
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_RESENT,
  isCompleteEmailCode,
  isEmailUnconfirmedMessage,
  normalizeEmailCode,
} from "./email-code.ts";

export { looksLikeEmail, normalizeIdentifier } from "./support.ts";
