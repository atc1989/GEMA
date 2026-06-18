import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database/types";

export type CurrentProfile = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  isAdmin: boolean;
};

/**
 * Resolves the logged-in user's profile, or null when there is no session or
 * no matching profiles row.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    isAdmin: data.is_admin,
  };
}

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
