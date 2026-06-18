"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { createReferralSchema, type CreateReferralInput } from "@/lib/schemas/member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ReferralLink = {
  refCode: string;
  eventId: string | null;
};

function newRefCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Creates (or returns the existing) referral link for the current member, scoped
 * to an event when eventId is provided. Inserts directly under RLS
 * (referrer_member_id must equal current_member_id()).
 */
export async function createReferralLink(
  input: CreateReferralInput,
): Promise<ActionResult<ReferralLink>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "You must be signed in." };

  const parsed = createReferralSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }
  const eventId = parsed.data.eventId ?? null;

  const supabase = await createSupabaseServerClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (memberError) return { ok: false, error: memberError.message };
  if (!member || member.status !== "active") {
    return { ok: false, error: "Only active members can create referral links." };
  }

  // Reuse an existing link for this member + event so there is one per event.
  let existing = supabase
    .from("referrals")
    .select("ref_code, event_id")
    .eq("referrer_member_id", member.id);
  existing = eventId ? existing.eq("event_id", eventId) : existing.is("event_id", null);

  const { data: found } = await existing.limit(1).maybeSingle();
  if (found) {
    return { ok: true, data: { refCode: found.ref_code, eventId: found.event_id } };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = newRefCode();
    const { error } = await supabase.from("referrals").insert({
      ref_code: refCode,
      referrer_member_id: member.id,
      event_id: eventId,
      status: "active",
    });

    if (!error) {
      revalidatePath("/member/referrals");
      return { ok: true, data: { refCode, eventId } };
    }

    const m = error.message.toLowerCase();
    const isCollision = m.includes("duplicate") || m.includes("unique") || m.includes("ref_code");
    if (!isCollision) {
      console.error("createReferralLink insert failed:", error);
      return { ok: false, error: devError(error) };
    }
  }

  return { ok: false, error: "Could not create referral link. Please try again." };
}

function devError(error: { message: string; code?: string }): string {
  if (process.env.NODE_ENV !== "production") {
    return `Could not create referral link: ${error.message}`;
  }
  return "Could not create referral link. Please try again.";
}
