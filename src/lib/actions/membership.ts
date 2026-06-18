"use server";

import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { onboardMemberSchema, type OnboardMemberInput } from "@/lib/schemas/member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type OnboardResult = {
  memberId: string;
  memberCode: string;
  username: string;
};

/** Creates (or returns) an active member for the signed-in user via the onboard_member RPC. */
export async function onboardMember(
  input: OnboardMemberInput,
): Promise<ActionResult<OnboardResult>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = onboardMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("onboard_member", {
    p_username: parsed.data.username,
    p_sponsor_ref: parsed.data.sponsorRef ?? null,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("taken")) {
      return {
        ok: false,
        error: "That username is already taken.",
        fieldErrors: { username: ["That username is already taken."] },
      };
    }
    return { ok: false, error: "Could not complete onboarding. Please try again." };
  }

  const result = data as { member_id: string; member_code: string; username: string };
  return {
    ok: true,
    data: {
      memberId: result.member_id,
      memberCode: result.member_code,
      username: result.username,
    },
  };
}
