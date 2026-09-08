import { cache } from "react";
import { redirect } from "next/navigation";

import { logAuthRedirect } from "@/lib/auth/auth-diagnostics";
import {
  AuthCheckFailedError,
  getAuthState,
  type CurrentProfile,
} from "@/lib/auth/require-admin";
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

export type MemberState = {
  context: CurrentMemberContext | null;
  /** See AuthState.checkFailed — the members query errored, or the auth check did. */
  checkFailed: boolean;
};

/**
 * Resolves the signed-in user's profile + member row and says whether the
 * lookup itself worked. Wrapped in React cache() so layout + page calls in one
 * request share a single query.
 */
export const getMemberState = cache(async (): Promise<MemberState> => {
  const { profile, checkFailed } = await getAuthState();
  if (!profile) return { context: null, checkFailed };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, member_code, username, status, sponsor_member_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error || !data) {
    logAuthRedirect(error ? "members query failed" : "no members row for this profile", {
      profileId: profile.id,
      error: error?.message ?? null,
      code: error?.code ?? null,
    });
    return { context: null, checkFailed: Boolean(error) };
  }

  return {
    context: {
      profile,
      member: {
        id: data.id,
        memberCode: data.member_code,
        username: data.username,
        status: data.status,
        sponsorMemberId: data.sponsor_member_id,
      },
    },
    checkFailed: false,
  };
});

/**
 * The member context, or null when there is no session or no member row.
 * Callers that gate access must use getMemberState() — null on its own cannot
 * tell a failed query from someone who genuinely has no member row.
 */
export const getCurrentMember = async (): Promise<CurrentMemberContext | null> =>
  (await getMemberState()).context;

/**
 * Guard for the member workspace. Redirects to /login when unauthenticated and
 * to /onboarding when signed in without a member row.
 */
export async function requireMember(redirectTo?: string): Promise<CurrentMemberContext> {
  const { profile, checkFailed: authCheckFailed } = await getAuthState();
  if (!profile) {
    if (authCheckFailed) throw new AuthCheckFailedError();
    const target = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${target}`);
  }

  const { context, checkFailed } = await getMemberState();
  if (!context) {
    // A members query that errored has not said this person lacks a member row.
    // Sending a real member to /onboarding is the same mistake as sending them
    // to /login, one table further down.
    if (checkFailed) throw new AuthCheckFailedError();
    redirect("/onboarding");
  }

  return context;
}
