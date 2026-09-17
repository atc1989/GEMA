"use server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { escapeIlike, phoneVariants } from "@/lib/utils/phone";

const lookupSchema = z.object({
  passCode: z.string().trim().min(4).max(64),
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(5).max(160),
});

/**
 * Re-issues the QR token for one pass, so the landing can offer a download
 * without ever having stored that token.
 *
 * The token is what gets somebody through the door. Keeping it in the browser
 * would mean a shared phone or a computer-shop machine hands the next person
 * the previous guest's pass — so the landing remembers only the pass code, the
 * name and the contact, and asks for the token when it is actually wanted.
 *
 * The gate is the same one /passes uses, and for the same reason: name AND the
 * email or mobile. An email alone is shared across group sign-ups and reused
 * numbers, so on its own it would hand over somebody else's pass.
 */
export async function issuePassQrToken(input: {
  passCode: string;
  name: string;
  contact: string;
}): Promise<{ ok: true; token: string; passCode: string } | { ok: false; error: string }> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter your name and the email or mobile you used." };
  const { passCode, name, contact } = parsed.data;

  // Admin client: the guest is anonymous, and this is a deliberate, verified
  // read of one row rather than a policy the anon role could exploit.
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("event_registrations")
    .select("qr_payload, pass_code")
    .eq("registration_kind", "prospect")
    .neq("status", "cancelled")
    .eq("pass_code", passCode)
    .ilike("attendee_name", escapeIlike(name))
    .limit(1);

  query = contact.includes("@")
    ? query.eq("attendee_email", contact.toLowerCase())
    : query.in("attendee_phone", phoneVariants(contact));

  const { data, error } = await query.maybeSingle<{ qr_payload: string; pass_code: string }>();

  if (error) {
    console.error("issuePassQrToken failed:", error.code, error.message);
    return { ok: false, error: "Could not fetch your pass. Please try again." };
  }
  if (!data?.qr_payload) {
    return { ok: false, error: "We could not match that pass. Try the lookup page." };
  }

  return { ok: true, token: data.qr_payload, passCode: data.pass_code };
}
