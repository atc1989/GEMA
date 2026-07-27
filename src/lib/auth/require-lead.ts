import { cache } from "react";
import { redirect } from "next/navigation";

import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProspectStage } from "@/lib/database/types";

export type CurrentLead = {
  prospectId: string;
  fullName: string;
  stage: ProspectStage;
};

export type CurrentLeadContext = {
  profile: CurrentProfile;
  lead: CurrentLead;
};

/**
 * Returns the signed-in user's lead context: a prospect who has attended at
 * least one event but hasn't converted to a member. Null for anyone else (no
 * session, no prospect row, not yet attended, already converted, or — a
 * real member's profile could in principle share an email with an unrelated
 * prospect row — already has a members row).
 */
export const getCurrentLead = cache(async (): Promise<CurrentLeadContext | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createSupabaseServerClient();

  const { data: memberRow } = await supabase
    .from("members")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (memberRow) return null;

  const { data, error } = await supabase
    .from("prospects")
    .select("id, full_name, stage, converted_member_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error || !data || data.converted_member_id) return null;
  if (data.stage !== "attended" && data.stage !== "followup") return null;

  return {
    profile,
    lead: { prospectId: data.id, fullName: data.full_name, stage: data.stage },
  };
});

/**
 * Guard for the lead's referral page. Redirects to /login when
 * unauthenticated, and to /onboarding when signed in without an active lead
 * context (includes real members — requireMember() is the guard for them).
 */
export async function requireLead(): Promise<CurrentLeadContext> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?redirectTo=/lead");
  }

  const ctx = await getCurrentLead();
  if (!ctx) {
    redirect("/onboarding");
  }

  return ctx;
}
