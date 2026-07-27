"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function newRefCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Creates (or returns the existing) general referral link for the current
 * lead (an attended, unconverted prospect). Same one-link shape as
 * createReferralLink in referrals.ts, but keyed to the caller's prospects
 * row and inserted under the referrals_insert_lead RLS policy instead of
 * current_member_id().
 */
export async function createLeadReferralLink(): Promise<ActionResult<{ refCode: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "You must be signed in." };

  const supabase = await createSupabaseServerClient();

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select("id, stage, converted_member_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (prospectError) return { ok: false, error: prospectError.message };
  if (!prospect || prospect.converted_member_id || !["attended", "followup"].includes(prospect.stage)) {
    return { ok: false, error: "Only attended leads can create a referral link." };
  }

  const { data: found } = await supabase
    .from("referrals")
    .select("ref_code")
    .eq("referrer_prospect_id", prospect.id)
    .limit(1)
    .maybeSingle();

  if (found) {
    return { ok: true, data: { refCode: found.ref_code } };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = newRefCode();
    const { error } = await supabase.from("referrals").insert({
      ref_code: refCode,
      referrer_prospect_id: prospect.id,
      status: "active",
    });

    if (!error) {
      revalidatePath("/lead");
      return { ok: true, data: { refCode } };
    }

    const m = error.message.toLowerCase();
    const isCollision = m.includes("duplicate") || m.includes("unique") || m.includes("ref_code");
    if (!isCollision) {
      console.error("createLeadReferralLink insert failed:", error);
      return { ok: false, error: "Could not create referral link. Please try again." };
    }
  }

  return { ok: false, error: "Could not create referral link. Please try again." };
}
