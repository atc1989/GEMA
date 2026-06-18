"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { convertProspectSchema, type ConvertProspectInput } from "@/lib/schemas/commission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Converts a prospect into an active member. Creates (or links) an auth account
 * + profile via the service-role client, then runs the DB transaction
 * (member + genealogy + commissions) through the convert_prospect_to_member RPC.
 */
export async function convertProspect(
  input: ConvertProspectInput,
): Promise<ActionResult<{ memberId: string }>> {
  await requireAdmin();

  const parsed = convertProspectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: prospect, error: loadError } = await supabase
    .from("prospects")
    .select("id, full_name, email, profile_id, converted_member_id")
    .eq("id", parsed.data.prospectId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!prospect) return { ok: false, error: "Prospect not found." };
  if (prospect.converted_member_id) {
    return { ok: false, error: "This prospect has already been converted." };
  }

  // Resolve the profile to attach the member to.
  let profileId = prospect.profile_id as string | null;

  if (!profileId) {
    if (!prospect.email) {
      return { ok: false, error: "Prospect has no email, so an account can't be created." };
    }

    const admin = createSupabaseAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: prospect.email,
      email_confirm: true,
      password: randomUUID() + "Aa1!",
      user_metadata: { full_name: prospect.full_name },
    });

    if (created?.user) {
      profileId = created.user.id;
    } else {
      // Likely the email already has an account — reuse its profile.
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", prospect.email)
        .maybeSingle();
      if (!existingProfile) {
        return {
          ok: false,
          error: createError?.message ?? "Could not create an account for this prospect.",
        };
      }
      profileId = existingProfile.id;
    }

    // Ensure a profile row exists (no signup trigger in this project).
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: profileId,
        email: prospect.email,
        full_name: prospect.full_name,
        role: "member",
      },
      { onConflict: "id" },
    );
    if (profileError) {
      return { ok: false, error: profileError.message };
    }
  }

  const { data, error } = await supabase.rpc("convert_prospect_to_member", {
    p_prospect_id: parsed.data.prospectId,
    p_profile_id: profileId,
    p_basis_amount: parsed.data.basisAmount,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already converted")) {
      return { ok: false, error: "This prospect has already been converted." };
    }
    if (m.includes("already a member")) {
      return { ok: false, error: "That account is already a member." };
    }
    return { ok: false, error: "Could not convert prospect. Please try again." };
  }

  const result = data as { member_id: string };
  revalidatePath("/admin/prospects");
  revalidatePath("/admin/commissions");
  return { ok: true, data: { memberId: result.member_id } };
}
