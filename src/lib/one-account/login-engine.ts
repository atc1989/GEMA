import "server-only";

import { createIdentityAdminClient, type IdentityAdminClient } from "./identity-client";
import { ExternalLoginError } from "./onegrinders";
import {
  emailForUsername,
  provisionOneGrindersLogin,
  syncExternalLoginInBackground,
} from "./provision";
import { looksLikeEmail, normalizeIdentifier } from "./support";

/**
 * One sign-in, the same on every origin (`04 - UX`): username or email in one
 * field, no `@` means OneGrinders, an email means the Supabase password.
 *
 * The engine never redirects and never renders. It returns an outcome and each
 * app decides where the member lands and what the form looks like.
 */

const THROTTLE_MAX_FAILURES = 5;
const THROTTLE_WINDOW_MINUTES = 15;

const BACKUP_WRONG_PASSWORD =
  "Our main login service is temporarily offline. Please try the password you originally " +
  "registered with the guild. If that doesn't work, use “Forgot password?” or contact your admin.";
const BACKUP_NO_ACCOUNT =
  "Login is temporarily offline for new members. Please try again in a while, " +
  "or contact your admin to get access now.";

export const THROTTLED_MESSAGE = `Too many failed attempts. Please wait ${THROTTLE_WINDOW_MINUTES} minutes and try again.`;

/** The slice of a Supabase cookie client the engine needs to open a session. */
export type SessionClient = {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
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
  | { ok: false; error: string };

export type LoginEngineOptions = {
  /** The app's own cookie/anon client — this is what gets the session. */
  getSessionClient: () => Promise<SessionClient>;
  /** Service-role client for the identity spine. Defaults to the shared one. */
  getAdminClient?: () => IdentityAdminClient;
  /** Caller IP for throttling, e.g. from the app's `headers()`. */
  getClientIp?: () => Promise<string | null>;
  /**
   * Runs work once the response is on its way — Next's `after()`. Without it
   * the re-verification is fire-and-forget instead.
   */
  runAfterResponse?: (task: () => Promise<void>) => void;
};

function adminClient(options: LoginEngineOptions) {
  return options.getAdminClient ? options.getAdminClient() : createIdentityAdminClient();
}

/** True when the identifier has too many recent failures to try again. */
async function isThrottled(identifier: string, options: LoginEngineOptions) {
  try {
    const since = new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
    const { count, error } = await adminClient(options)
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", identifier)
      .gte("created_at", since);
    // ponytail: per-identifier only; add a per-IP cap if bots rotate usernames.
    return !error && (count ?? 0) >= THROTTLE_MAX_FAILURES;
  } catch {
    // Missing service role or login_attempts table must never block sign-in.
    return false;
  }
}

/** Fire-and-forget: a logging failure must never block a login. */
async function recordFailedLogin(identifier: string, options: LoginEngineOptions) {
  try {
    const clientIp = options.getClientIp ? await options.getClientIp() : null;
    await adminClient(options)
      .from("login_attempts")
      .insert({ username: identifier, client_ip: clientIp });
  } catch {
    // Ignore missing table/key — throttle is best-effort.
  }
}

export function createLoginEngine(options: LoginEngineOptions) {
  const runAfter =
    options.runAfterResponse ??
    ((task: () => Promise<void>) => {
      void task();
    });

  /**
   * Signs a local email user or verified OneGrinders username into the Supabase
   * session used by this app's RLS policies and protected routes.
   */
  async function signIn(input: {
    identifier: string;
    password: string;
  }): Promise<LoginOutcome> {
    let email = input.identifier.trim();
    const password = input.password;

    if (!email) return { ok: false, error: "Username or email is required." };
    if (!password) return { ok: false, error: "Password is required." };

    const identifier = normalizeIdentifier(email);
    const usedUsername = !looksLikeEmail(email);

    if (await isThrottled(identifier, options)) {
      return { ok: false, error: THROTTLED_MESSAGE };
    }

    const supabase = await options.getSessionClient();
    let signInPassword = password;
    let backupLogin = false;

    if (usedUsername) {
      // Local-first: returning members sign in against the mirrored password in
      // a few round trips instead of waiting on the external API. The external
      // account is still re-verified — just off the critical path (see below).
      const localEmail = await emailForUsername(identifier, options.getAdminClient?.());
      if (localEmail) {
        const { data, error: localError } = await supabase.auth.signInWithPassword({
          email: localEmail,
          password,
        });
        if (!localError) {
          // Re-verify credentials/status with the external system and refresh
          // the mirrored profile after the response is sent; a stale or
          // deactivated mirror gets revoked there so it stops working on the
          // next attempt, on every app that shares this Auth project.
          runAfter(() => syncExternalLoginInBackground(identifier, password));
          return {
            ok: true,
            backupLogin: false,
            usedUsername,
            userId: data.user?.id ?? null,
            email: localEmail,
          };
        }
        // Local attempt failed (first login, changed external password, imported
        // account) — fall through to the full external verification below.
      }

      try {
        const provisioned = await provisionOneGrindersLogin(email, password);
        email = provisioned.email;
        signInPassword = provisioned.password;
      } catch (error) {
        if (error instanceof ExternalLoginError && error.kind === "remote") {
          // External API unreachable — try the locally mirrored password instead.
          const fallbackEmail = await emailForUsername(identifier, options.getAdminClient?.());
          if (!fallbackEmail) {
            return { ok: false, error: BACKUP_NO_ACCOUNT };
          }
          email = fallbackEmail;
          backupLogin = true;
        } else if (error instanceof ExternalLoginError) {
          if (error.kind === "credentials") await recordFailedLogin(identifier, options);
          return { ok: false, error: error.message };
        } else {
          return { ok: false, error: "Unable to verify this login right now." };
        }
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: signInPassword,
    });

    if (error) {
      await recordFailedLogin(identifier, options);
      return {
        ok: false,
        error: backupLogin ? BACKUP_WRONG_PASSWORD : "Invalid email or password.",
      };
    }

    return {
      ok: true,
      backupLogin,
      usedUsername,
      userId: data.user?.id ?? null,
      email,
    };
  }

  return { signIn };
}
