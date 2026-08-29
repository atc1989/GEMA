/**
 * Staging's **Confirm signup** template emails a 6-digit code (the GEMA partner
 * template), not a confirmation link. A member who registers and then tries to
 * sign in is told "Email not confirmed" with no way forward, and the common
 * mistake is to type the code into the password field.
 *
 * Every app that hosts sign-in offers the same code step with the same words,
 * so the copy lives here rather than in each form.
 */

export const EMAIL_CODE_LENGTH = 6;

export const EMAIL_CODE_COPY =
  "Enter the 6-digit code from your Gutguard email, then continue.";

export const EMAIL_CODE_HINT =
  "The message may say partner sign-in. Type that number here — not as your password.";

export const EMAIL_CODE_RESENT = "A new code is on its way. Check your email.";

/** Codes are typed with spaces and dashes; keep the digits. */
export function normalizeEmailCode(value: string) {
  return value.replace(/\D/g, "");
}

export function isCompleteEmailCode(value: string) {
  return normalizeEmailCode(value).length === EMAIL_CODE_LENGTH;
}

/** Supabase says this when the address exists but was never confirmed. */
export function isEmailUnconfirmedMessage(message: string | undefined | null) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("not confirmed") || lower.includes("email_not_confirmed");
}
