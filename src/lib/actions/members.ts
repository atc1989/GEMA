"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const schema = z.object({ memberId: z.string().uuid() });

/**
 * Admin-only: sets a fresh temporary password for a member's auth account and
 * returns the email + password so the admin can sign in as them (useful for
 * demoing the member-facing views of converted accounts). Works without SMTP.
 */
export async function setMemberPassword(input: {
  memberId: string;
}): Promise<ActionResult<{ email: string; password: string }>> {
  await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createSupabaseServerClient();
  const { data: member, error } = await supabase
    .from("members")
    .select("profile_id")
    .eq("id", parsed.data.memberId)
    .maybeSingle();

  if (error || !member) return { ok: false, error: "Member not found." };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", member.profile_id)
    .maybeSingle();

  const password = `Gema-${randomBytes(4).toString("hex")}!`;
  const { error: updateError } = await admin.auth.admin.updateUserById(member.profile_id, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, data: { email: profile?.email ?? "(unknown email)", password } };
}
