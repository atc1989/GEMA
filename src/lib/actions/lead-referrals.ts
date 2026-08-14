"use server";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { escapeIlike, phoneVariants } from "@/lib/utils/phone";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function newRefCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Creates (or returns the existing) referral link for a lead — a prospect who
 * has attended an event. Same one-link shape as createReferralLink in
 * referrals.ts, keyed to the prospects row instead of a member.
 *
 * Leads have no account, so this re-runs the same name + email/phone match
 * /passes uses rather than trusting a prospect id from the client. That pair
 * is the same gate the QR passes sit behind, and a referral link is meant to
 * be shared publicly — fetching someone else's only earns credit for them.
 */
export async function createPassReferralLink(input: {
  name: string;
  query: string;
}): Promise<ActionResult<{ refCode: string }>> {
  const name = input.name?.trim();
  const query = input.query?.trim();
  if (!name || !query) {
    return { ok: false, error: "Enter your full name and the email or mobile you registered with." };
  }

  // Service role: a lead has no session, so there is no RLS identity to match.
  const admin = createSupabaseAdminClient();

  let lookup = admin
    .from("event_registrations")
    .select("prospect_id, prospects!inner(id, stage, converted_member_id)")
    .eq("registration_kind", "prospect")
    .eq("status", "attended")
    .ilike("attendee_name", escapeIlike(name))
    .limit(1);

  lookup = query.includes("@")
    ? lookup.eq("attendee_email", query.toLowerCase())
    : lookup.in("attendee_phone", phoneVariants(query));

  const { data: match, error: lookupError } = await lookup.maybeSingle<{
    prospect_id: string | null;
    prospects: { id: string; stage: string; converted_member_id: string | null };
  }>();

  if (lookupError) {
    console.error("createPassReferralLink lookup failed:", lookupError);
    return { ok: false, error: "Could not create referral link. Please try again." };
  }
  if (!match?.prospect_id || match.prospects.converted_member_id) {
    return { ok: false, error: "Attend an event first to get your referral link." };
  }

  const { data: found } = await admin
    .from("referrals")
    .select("ref_code")
    .eq("referrer_prospect_id", match.prospect_id)
    .limit(1)
    .maybeSingle<{ ref_code: string }>();

  if (found) {
    return { ok: true, data: { refCode: found.ref_code } };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = newRefCode();
    const { error } = await admin.from("referrals").insert({
      ref_code: refCode,
      referrer_prospect_id: match.prospect_id,
      status: "active",
    });

    if (!error) {
      return { ok: true, data: { refCode } };
    }

    const m = error.message.toLowerCase();
    const isCollision = m.includes("duplicate") || m.includes("unique") || m.includes("ref_code");
    if (!isCollision) {
      console.error("createPassReferralLink insert failed:", error);
      return { ok: false, error: "Could not create referral link. Please try again." };
    }
  }

  return { ok: false, error: "Could not create referral link. Please try again." };
}
