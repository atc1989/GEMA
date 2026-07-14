"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { externalEmailForUsername } from "@/lib/integrations/onegrinders-login";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const importRowSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(100),
  email: z.string().trim().email("Invalid email.").nullable(),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const importSchema = z.array(importRowSchema).min(1, "No rows to import.").max(500);

export type ImportRow = z.infer<typeof importRowSchema>;

export type ImportRowResult = {
  username: string;
  outcome: "created" | "updated" | "failed";
  reason?: string;
};

export type ImportResult = { ok: true; data: ImportRowResult[] } | { ok: false; error: string };

/**
 * Backup-credential uploader: gives members a working local login (and
 * optionally a real email) so GEMA keeps running when the external
 * OneGrinders API is down. Existing members get their local password/email
 * updated; unknown usernames get a full local account (auth user + profile +
 * member row with a TMP- member code that the next successful external login
 * replaces with the real OGG- code).
 */
export async function importMemberCredentials(input: ImportRow[]): Promise<ImportResult> {
  await requireAdmin();

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createSupabaseAdminClient();
  const results: ImportRowResult[] = [];

  for (const row of parsed.data) {
    const username = row.username.toLowerCase();
    const email = row.email?.toLowerCase() ?? null;

    try {
      const { data: member, error: memberError } = await admin
        .from("members")
        .select("profile_id")
        .eq("username", username)
        .maybeSingle<{ profile_id: string }>();
      if (memberError) throw new Error(memberError.message);

      if (member) {
        results.push(await updateExisting(member.profile_id, username, email, row.password));
      } else {
        results.push(await createNew(username, email, row.password));
      }
    } catch (error) {
      results.push({
        username,
        outcome: "failed",
        reason: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  return { ok: true, data: results };
}

async function updateExisting(
  profileId: string,
  username: string,
  email: string | null,
  password: string,
): Promise<ImportRowResult> {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.auth.admin.updateUserById(profileId, {
    password,
    ...(email ? { email, email_confirm: true } : {}),
  });
  if (error) return { username, outcome: "failed", reason: error.message };

  if (email) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ email })
      .eq("id", profileId);
    if (profileError) {
      return { username, outcome: "failed", reason: profileError.message };
    }
  }

  return { username, outcome: "updated" };
}

async function createNew(
  username: string,
  email: string | null,
  password: string,
): Promise<ImportRowResult> {
  const admin = createSupabaseAdminClient();
  const authEmail = email ?? externalEmailForUsername(username);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: username },
  });

  let profileId = created?.user?.id ?? null;
  let outcome: ImportRowResult["outcome"] = "created";

  if (!profileId) {
    // The email may already have an account (e.g. a previous partial import).
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", authEmail)
      .maybeSingle<{ id: string }>();
    if (!existingProfile) {
      return {
        username,
        outcome: "failed",
        reason: createError?.message ?? "Could not create the account.",
      };
    }
    profileId = existingProfile.id;
    outcome = "updated";
    const { error } = await admin.auth.admin.updateUserById(profileId, { password });
    if (error) return { username, outcome: "failed", reason: error.message };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    { id: profileId, email: authEmail, full_name: username, role: "member" },
    { onConflict: "id" },
  );
  if (profileError) return { username, outcome: "failed", reason: profileError.message };

  const { error: memberError } = await admin.from("members").upsert(
    {
      profile_id: profileId,
      member_code: `TMP-${username.toUpperCase()}`,
      username,
      status: "active",
      activated_at: new Date().toISOString(),
      metadata: { provider: "admin_import" },
    },
    { onConflict: "profile_id" },
  );
  if (memberError) return { username, outcome: "failed", reason: memberError.message };

  return { username, outcome };
}
