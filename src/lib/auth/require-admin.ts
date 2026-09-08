import { cache } from "react";
import { redirect } from "next/navigation";

import { isTransientAuthFailure, logAuthRedirect } from "@/lib/auth/auth-diagnostics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database/types";

export type CurrentProfile = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  isAdmin: boolean;
  canPublishEvents: boolean;
};

export type AuthState = {
  profile: CurrentProfile | null;
  /**
   * The auth check itself failed — it did NOT establish that this person is
   * signed out. `getClaims()` refreshes the token and fetches signing keys over
   * the network, so a slow edge fetch or an auth-server blip lands here; so
   * does a profiles query that errored.
   *
   * Anything that gates access must branch on this. Treating it as "signed
   * out" is what signs people out: they arrive holding a good session, get
   * redirected to /login, and the session they had is gone.
   */
  checkFailed: boolean;
};

/**
 * Resolves the logged-in user's profile and says whether the check itself
 * worked. Wrapped in React cache() so multiple calls within the same request
 * share a single DB round-trip.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createSupabaseServerClient();

  // Local JWT verification (asymmetric keys) instead of an auth-server round
  // trip; falls back to a server check on legacy symmetric secrets.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    // A dead session is not a failed check. "Invalid Refresh Token: Refresh
    // Token Not Found" is the auth server's verdict, not an outage, and the
    // only thing that recovers it is signing in again — so it must reach
    // /login, not the error boundary.
    const transient = isTransientAuthFailure(claimsError);
    logAuthRedirect(
      claimsError
        ? transient
          ? "claims check failed — keeping the session"
          : "auth server says this session is gone — sign in again"
        : "no session claims",
      { claimsError: claimsError?.message ?? null, transient },
    );
    return { profile: null, checkFailed: transient };
  }

  // gema.profiles — the server client pins `db: { schema: "gema" }`. Two tables
  // are named profiles and this is the person one.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_admin, can_publish_events")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    logAuthRedirect(error ? "profiles query failed" : "no profiles row for this user", {
      userId,
      error: error?.message ?? null,
      code: error?.code ?? null,
    });
    return { profile: null, checkFailed: Boolean(error) };
  }

  return {
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      isAdmin: data.is_admin,
      canPublishEvents: data.can_publish_events ?? false,
    },
    checkFailed: false,
  };
});

/**
 * The profile, or null for anyone not signed in.
 *
 * Public surfaces want exactly this: null means "render the anonymous view",
 * and a transient auth failure degrading to anonymous is the right outcome
 * there. Guards must use getAuthState() instead — null on its own cannot tell
 * a failed check from a signed-out user.
 */
export const getCurrentProfile = async (): Promise<CurrentProfile | null> =>
  (await getAuthState()).profile;

/**
 * A check that could not complete. Never thrown for a signed-out user — those
 * still redirect to /login.
 */
export class AuthCheckFailedError extends Error {
  constructor() {
    super("Could not verify the session");
    this.name = "AuthCheckFailedError";
  }
}

/**
 * Guard for admin-only surfaces. Redirects to /login when unauthenticated and
 * to / when the user is signed in but lacks admin rights. RLS remains the
 * authoritative check on every query/mutation; this is defense-in-depth and
 * provides clean redirects in the UI.
 */
export async function requireAdmin(): Promise<CurrentProfile> {
  const { profile, checkFailed } = await getAuthState();

  if (!profile) {
    // Throwing keeps the session. Redirecting to /login destroys it, which is
    // the bug: the middleware now passes a failed check through to this guard,
    // and this guard used to finish the sign-out the middleware stopped doing.
    if (checkFailed) throw new AuthCheckFailedError();
    redirect("/login");
  }

  if (!profile.isAdmin && profile.role !== "admin") {
    redirect("/");
  }

  return profile;
}

/**
 * Guard for event-scoped management surfaces (e.g. attendance check-in).
 * Requires a session and that the user can manage the given event — delegated
 * to the DB `can_manage_event()` function (admin OR creator/host), which is
 * also the RLS rule for attendance writes.
 */
export async function requireEventManager(eventId: string): Promise<CurrentProfile> {
  const { profile, checkFailed } = await getAuthState();
  if (!profile) {
    if (checkFailed) throw new AuthCheckFailedError();
    redirect(`/login?redirectTo=/member/events/${eventId}/attendance`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("can_manage_event", {
    target_event_id: eventId,
  });

  // An RPC that errored has not said this person may not manage the event.
  if (error) {
    logAuthRedirect("can_manage_event failed", {
      eventId,
      profileId: profile.id,
      error: error.message,
      code: error.code,
    });
    throw new AuthCheckFailedError();
  }

  if (data !== true) {
    redirect("/");
  }

  return profile;
}
