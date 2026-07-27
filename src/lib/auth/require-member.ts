import { cache } from "react";
import { redirect } from "next/navigation";

import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentLead } from "@/lib/auth/require-lead";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberStatus } from "@/lib/database/types";

export type CurrentMember = {
  id: string;
  memberCode: string;
  username: string;
  status: MemberStatus;
  sponsorMemberId: string | null;
};

export type CurrentMemberContext = {
  profile: CurrentProfile;
  member: CurrentMember;
};

/**
 * Returns the signed-in user's profile + active member row, or null. Wrapped in
 * React cache() so layout + page calls in one request share a single query.
 */
export const getCurrentMember = cache(async (): Promise<CurrentMemberContext | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, member_code, username, status, sponsor_member_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    profile,
    member: {
      id: data.id,
      memberCode: data.member_code,
      username: data.username,
      status: data.status,
      sponsorMemberId: data.sponsor_member_id,
    },
  };
});

/**
 * Guard for the member workspace. Redirects to /login when unauthenticated,
 * to /lead when signed in as a lead (attended, unconverted prospect), and to
 * /onboarding when signed in with neither a member nor a lead row.
 */
export async function requireMember(redirectTo?: string): Promise<CurrentMemberContext> {
  const profile = await getCurrentProfile();
  if (!profile) {
    const target = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${target}`);
  }

  const ctx = await getCurrentMember();
  if (!ctx) {
    const lead = await getCurrentLead();
    redirect(lead ? "/lead" : "/onboarding");
  }

  return ctx;
}
