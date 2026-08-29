import { EMAIL_CODE_COPY, isEmailUnconfirmedMessage } from "./email-code.ts";
import { ExternalLoginError } from "./onegrinders.ts";
import { looksLikeEmail, normalizeIdentifier } from "./support.ts";

/**
 * The sign-in decision tree, as a pure function over ports.
 *
 * Everything that touches Supabase, the guild API, or Next lives behind
 * `LoginPorts`, so the order of operations — throttle first, local mirror
 * before the slow API, backup password when the API is down — can be tested
 * with fakes instead of a live Staging project. `login-engine.ts` wires the
 * real ports in; nothing else should call this directly.
 */

export const THROTTLE_MAX_FAILURES = 5;
export const THROTTLE_WINDOW_MINUTES = 15;

export const THROTTLED_MESSAGE = `Too many failed attempts. Please wait ${THROTTLE_WINDOW_MINUTES} minutes and try again.`;

export const BACKUP_WRONG_PASSWORD =
  "Our main login service is temporarily offline. Please try the password you originally " +
  "registered with the guild. If that doesn't work, use “Forgot password?” or contact your admin.";

export const BACKUP_NO_ACCOUNT =
  "Login is temporarily offline for new members. Please try again in a while, " +
  "or contact your admin to get access now.";

/** The OneGrinders provisioner writes the identity spine and nothing else. */
export const ONEGRINDERS_PRODUCT_WRITES = ["profiles", "members"] as const;

export type SignInAttempt =
  | { ok: true; userId: string | null }
  | { ok: false; message?: string };

export type LoginPorts = {
  isThrottled: (identifier: string) => Promise<boolean>;
  recordFailedLogin: (identifier: string) => Promise<void>;
  /** Username → the auth email carrying its mirrored password. */
  emailForUsername: (username: string) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<SignInAttempt>;
  provisionOneGrinders: (
    username: string,
    password: string,
  ) => Promise<{ email: string; password: string }>;
  /** Re-verification, off the critical path once the response is out. */
  syncInBackground: (username: string, password: string) => void;
};

export type LoginOutcome =
  | {
      ok: true;
      /** Signed in against the mirrored password because OneGrinders was down. */
      backupLogin: boolean;
      /** The identifier was a username, not an email. */
      usedUsername: boolean;
      userId: string | null;
      email: string;
    }
  | {
      ok: false;
      error: string;
      /**
       * The address exists but was never confirmed. Staging emails a 6-digit
       * code rather than a link, so the app offers that step instead of a
       * dead end.
       */
      needsEmailConfirm?: boolean;
    };

export async function resolveLogin(
  identifierRaw: string,
  password: string,
  ports: LoginPorts,
): Promise<LoginOutcome> {
  let email = identifierRaw.trim();

  if (!email) return { ok: false, error: "Username or email is required." };
  if (!password) return { ok: false, error: "Password is required." };

  const identifier = normalizeIdentifier(email);
  const usedUsername = !looksLikeEmail(email);

  if (await ports.isThrottled(identifier)) {
    return { ok: false, error: THROTTLED_MESSAGE };
  }

  let signInPassword = password;
  let backupLogin = false;

  if (usedUsername) {
    // Local-first: returning members sign in against the mirrored password in
    // a few round trips instead of waiting on the external API. The external
    // account is still re-verified — just off the critical path (see below).
    const localEmail = await ports.emailForUsername(identifier);
    if (localEmail) {
      const local = await ports.signInWithPassword(localEmail, password);
      if (local.ok) {
        // Re-verify credentials/status with the external system and refresh
        // the mirrored profile after the response is sent; a stale or
        // deactivated mirror gets revoked there so it stops working on the
        // next attempt, on every app that shares this Auth project.
        ports.syncInBackground(identifier, password);
        return {
          ok: true,
          backupLogin: false,
          usedUsername,
          userId: local.userId,
          email: localEmail,
        };
      }
      // Local attempt failed (first login, changed external password, imported
      // account) — fall through to the full external verification below.
    }

    try {
      const provisioned = await ports.provisionOneGrinders(email, password);
      email = provisioned.email;
      signInPassword = provisioned.password;
    } catch (error) {
      if (error instanceof ExternalLoginError && error.kind === "remote") {
        // External API unreachable — try the locally mirrored password instead.
        const fallbackEmail = await ports.emailForUsername(identifier);
        if (!fallbackEmail) {
          return { ok: false, error: BACKUP_NO_ACCOUNT };
        }
        email = fallbackEmail;
        backupLogin = true;
      } else if (error instanceof ExternalLoginError) {
        if (error.kind === "credentials") await ports.recordFailedLogin(identifier);
        return { ok: false, error: error.message };
      } else {
        return { ok: false, error: "Unable to verify this login right now." };
      }
    }
  }

  const attempt = await ports.signInWithPassword(email, signInPassword);

  if (!attempt.ok) {
    // An unconfirmed address is not a wrong password: sending it to the code
    // step is the way forward, and it must not burn the throttle to get there.
    if (!usedUsername && isEmailUnconfirmedMessage(attempt.message)) {
      return { ok: false, error: EMAIL_CODE_COPY, needsEmailConfirm: true };
    }

    await ports.recordFailedLogin(identifier);
    return {
      ok: false,
      error: backupLogin ? BACKUP_WRONG_PASSWORD : "Invalid email or password.",
    };
  }

  return {
    ok: true,
    backupLogin,
    usedUsername,
    userId: attempt.userId,
    email,
  };
}
