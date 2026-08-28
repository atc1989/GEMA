import "server-only";

import { createIdentityAdminClient, type IdentityAdminClient } from "./identity-client.ts";
import {
  emailForUsername,
  provisionOneGrindersLogin,
  syncExternalLoginInBackground,
} from "./provision.ts";
import {
  resolveLogin,
  THROTTLE_MAX_FAILURES,
  THROTTLE_WINDOW_MINUTES,
  type LoginOutcome,
  type LoginPorts,
} from "./resolve.ts";

/**
 * One sign-in, the same on every origin (`04 - UX`): username or email in one
 * field, no `@` means OneGrinders, an email means the Supabase password.
 *
 * The decision tree lives in `resolve.ts` where it can be tested with fakes.
 * This file is the wiring: it turns an app's Supabase clients into the ports
 * that tree runs on. The engine never redirects and never renders — it returns
 * an outcome, and each app decides where the member lands.
 */

export { THROTTLED_MESSAGE, type LoginOutcome } from "./resolve.ts";

/** The slice of a Supabase cookie client the engine needs to open a session. */
export type SessionClient = {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

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

  const ports: LoginPorts = {
    isThrottled: (identifier) => isThrottled(identifier, options),
    recordFailedLogin: (identifier) => recordFailedLogin(identifier, options),
    emailForUsername: (username) => emailForUsername(username, options.getAdminClient?.()),
    signInWithPassword: async (email, password) => {
      const supabase = await options.getSessionClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: error.message };
      return { ok: true, userId: data.user?.id ?? null };
    },
    provisionOneGrinders: provisionOneGrindersLogin,
    syncInBackground: (username, password) => {
      runAfter(() => syncExternalLoginInBackground(username, password));
    },
  };

  /**
   * Signs a local email user or verified OneGrinders username into the Supabase
   * session used by this app's RLS policies and protected routes.
   */
  function signIn(input: { identifier: string; password: string }): Promise<LoginOutcome> {
    return resolveLogin(input.identifier, input.password, ports);
  }

  return { signIn };
}
