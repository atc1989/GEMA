import { cache } from "react";
import { redirect } from "next/navigation";

import { logAuthRedirect } from "@/lib/auth/auth-diagnostics";
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

/**
 * Resolves the logged-in user's profile, or null when there is no session or
 * no matching profiles row. Wrapped in React cache() so multiple calls within
 * the same request share a single DB round-trip.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createSupabaseServerClient();

  // Local JWT verification (asymmetric keys) instead of an auth-server round
  // trip; falls back to a server check on legacy symmetric secrets.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    logAuthRedirect("no session claims", { claimsError: claimsError?.message ?? null });
    return null;
  }

  // gema.profiles — the server client pins `db: { schema: "gema" }`. Two tables
  // are named profiles and this is the person one.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_admin, can_publish_events")
    .eq("id", userId)
    .maybeSingle();

  // A failed query and a missing row both return null, and both end at the
  // login page. Say which, or the next report is another screenshot.
  if (error || !data) {
    logAuthRedirect(error ? "profiles query failed" : "no profiles row for this user", {
      userId,
      error: error?.message ?? null,
      code: error?.code ?? null,
    });
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    isAdmin: data.is_admin,
    canPublishEvents: data.can_publish_events ?? false,
  };
});

/**
 * Guard for admin-only surfaces. Redirects to /login when unauthenticated and
 * to / when the user is signed in but lacks admin rights. RLS remains the
 * authoritative check on every query/mutation; this is defense-in-depth and
 * provides clean redirects in the UI.
 */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
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
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/login?redirectTo=/member/events/${eventId}/attendance`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("can_manage_event", {
    target_event_id: eventId,
  });

  if (error || data !== true) {
    redirect("/");
  }

  return profile;
}
