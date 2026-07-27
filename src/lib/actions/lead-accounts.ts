import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LEAD_EMAIL_DOMAIN = "gema-lead.local";
const LEAD_TEMP_PASSWORD = "abcd1234";

function leadEmailForPhone(phone: string): string {
  return `lead-${phone.replace(/[^0-9]/g, "")}@${LEAD_EMAIL_DOMAIN}`;
}

type LeadProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
};

/**
 * Provisions a login the first time a prospect attends an event ("lead").
 * No-ops if the prospect already has a profile. Reuses an existing account
 * by email (e.g. one already synced from One Grinders) instead of creating a
 * duplicate — same fallback pattern as convertProspect in conversion.ts.
 * Never downgrades an existing profile's role: only a freshly created
 * account is marked role='prospect'.
 */
export async function ensureLeadAccount(prospectId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: prospect, error: loadError } = await admin
    .from("prospects")
    .select("id, full_name, email, phone, profile_id")
    .eq("id", prospectId)
    .maybeSingle<LeadProspectRow>();

  if (loadError || !prospect || prospect.profile_id) return;

  const email = prospect.email?.trim() || (prospect.phone ? leadEmailForPhone(prospect.phone) : null);
  if (!email) return;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: LEAD_TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: prospect.full_name, must_reset_password: true },
  });

  let profileId: string;

  if (created?.user) {
    profileId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert(
      { id: profileId, email, full_name: prospect.full_name, role: "prospect" },
      { onConflict: "id" },
    );
    if (profileError) {
      console.error("[ensureLeadAccount] profile upsert failed", profileError);
      return;
    }
  } else {
    // Email already registered — reuse that account as-is, do not touch its
    // role (it may already be a real member).
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle<{ id: string }>();
    if (!existingProfile) {
      console.error("[ensureLeadAccount] createUser failed", { email, error: createError?.message });
      return;
    }
    profileId = existingProfile.id;
  }

  await admin.from("prospects").update({ profile_id: profileId }).eq("id", prospect.id);
}
