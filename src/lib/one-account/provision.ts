import "server-only";

import type { User } from "@supabase/supabase-js";

import { createIdentityAdminClient, type IdentityAdminClient } from "./identity-client";
import { isMissingTable } from "./support";
import {
  ExternalLoginError,
  externalEmailForUsername,
  externalFullName,
  externalTimestamp,
  externalUserMetadata,
  memberCodeForExternalUser,
  normalizeUsername,
  profilePhotoUrl,
  verifyExternalCredentials,
  type ExternalLoginAccount,
  type ExternalLoginProvisionResult,
} from "./onegrinders";

/**
 * The identity spine: one `auth.users.id` is one person, and the GEMA
 * profile/member rows describe that person. Every app that hosts login runs the
 * same provisioning, so a member who first signs in on Academy or Lifestyle is
 * the same person GEMA already knows.
 *
 * It writes the spine and nothing else — no Academy BASE row, no Lifestyle
 * card. Those are lazy, created on first visit to that spoke (Change 4).
 */

function admin(client?: IdentityAdminClient) {
  return client ?? createIdentityAdminClient();
}

/**
 * Members imported via the admin uploader (or upgraded with a real email) are
 * found by username, not by the synthetic email — their auth email may be real.
 */
async function findProfileIdByUsername(
  username: string,
  client?: IdentityAdminClient,
): Promise<string | null> {
  const { data, error } = await admin(client)
    .from("members")
    .select("profile_id")
    .eq("username", username)
    .maybeSingle<{ profile_id: string }>();

  // A spoke may share Auth before the member table exists next to it; provision
  // against the synthetic email there instead of refusing the login.
  if (error && isMissingTable(error)) return null;
  if (error) {
    throw new ExternalLoginError("Unable to inspect local member accounts.", "provisioning");
  }
  return data?.profile_id ?? null;
}

/**
 * Backup path for when the external login API is unreachable, and the
 * local-first fast path for returning members: resolve a username to the auth
 * email that carries its mirrored password.
 */
export async function emailForUsername(
  username: string,
  client?: IdentityAdminClient,
): Promise<string | null> {
  try {
    const supabase = admin(client);
    const { data: member } = await supabase
      .from("members")
      .select("profile_id")
      .eq("username", normalizeUsername(username))
      .maybeSingle<{ profile_id: string }>();
    if (!member) return null;

    const { data } = await supabase.auth.admin.getUserById(member.profile_id);
    return data.user?.email ?? null;
  } catch {
    // A missing table or service-role key must never block sign-in.
    return null;
  }
}

async function findAuthUserByEmail(
  email: string,
  client?: IdentityAdminClient,
): Promise<User | null> {
  const supabase = admin(client);
  const perPage = 100;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new ExternalLoginError("Unable to inspect local auth users.", "provisioning");
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  return null;
}

/**
 * Mirrors the member's verified external password onto the local auth user so
 * login still works on every app when the external API is down.
 */
async function syncAuthUser(
  profileId: string,
  password: string,
  account: ExternalLoginAccount,
  client?: IdentityAdminClient,
) {
  const { data, error } = await admin(client).auth.admin.updateUserById(profileId, {
    password,
    user_metadata: externalUserMetadata(account),
  });
  if (error || !data.user) {
    throw new ExternalLoginError("Unable to update the local auth user.", "provisioning");
  }
  return data.user;
}

async function ensureAuthUser(
  email: string,
  password: string,
  account: ExternalLoginAccount,
  client?: IdentityAdminClient,
) {
  const supabase = admin(client);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (profile?.id) {
    return syncAuthUser(profile.id, password, account, supabase);
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: externalUserMetadata(account),
  });

  if (!createError && created.user) return created.user;

  const detail = createError
    ? [
        createError.name,
        "status" in createError ? `status=${createError.status}` : null,
        "code" in createError ? `code=${createError.code}` : null,
        createError.message,
      ]
        .filter(Boolean)
        .join(" ")
    : "no error returned";
  console.error("[one-account] createUser failed", { email, detail });

  const existing = await findAuthUserByEmail(email, supabase);
  if (!existing) {
    throw new ExternalLoginError(`Unable to create the local auth user (${detail}).`, "provisioning");
  }

  return syncAuthUser(existing.id, password, account, supabase);
}

async function ensureProfileAndMember(
  userId: string,
  email: string,
  account: ExternalLoginAccount,
  client?: IdentityAdminClient,
) {
  const supabase = admin(client);
  const username = normalizeUsername(account.user.username || account.profile.username);
  const fullName = externalFullName(account);

  // Keep a real email (set by the admin import) — only fill it when missing.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string | null }>();

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email: existingProfile?.email ?? email,
    full_name: fullName,
    avatar_url: profilePhotoUrl(account.user.profile_photo),
    role: "member",
    is_admin: false,
    last_seen_at: new Date().toISOString(),
  });
  if (profileError && !isMissingTable(profileError)) {
    throw new ExternalLoginError("Unable to save the local profile.", "provisioning");
  }

  const { data: usernameOwner, error: usernameError } = await supabase
    .from("members")
    .select("profile_id")
    .eq("username", username)
    .maybeSingle<{ profile_id: string }>();

  // Identity is already established above; a spoke without the member table
  // still gets a working session, it just has no GEMA member row to keep.
  if (usernameError && isMissingTable(usernameError)) {
    console.warn("[one-account] member table absent, skipped member sync", { username });
    return;
  }

  if (usernameError) {
    throw new ExternalLoginError("Unable to inspect local member usernames.", "provisioning");
  }

  if (usernameOwner && usernameOwner.profile_id !== userId) {
    throw new ExternalLoginError(
      "This username already belongs to another local member account.",
      "provisioning",
    );
  }

  const { data: sponsor, error: sponsorError } = account.user.referrer
    ? await supabase
        .from("members")
        .select("id")
        .eq("username", normalizeUsername(account.user.referrer))
        .maybeSingle<{ id: string }>()
    : { data: null, error: null };

  if (sponsorError) {
    throw new ExternalLoginError("Unable to inspect the external referrer account.", "provisioning");
  }

  const { data: currentMember, error: memberLookupError } = await supabase
    .from("members")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle<{ id: string }>();

  if (memberLookupError) {
    throw new ExternalLoginError("Unable to inspect the local member account.", "provisioning");
  }

  const memberPayload: Record<string, unknown> = {
    profile_id: userId,
    member_code: memberCodeForExternalUser(account.user.id),
    username,
    status: "active",
    joined_at: externalTimestamp(account.user.created_at),
    activated_at: new Date().toISOString(),
    metadata: {
      provider: "onegrindersguild",
      external_user_id: account.user.id,
      external_profile_id: account.profile.id,
      external_role_id: account.user.role_id,
      external_rank_title: account.profile.rank_title,
      city: account.profile.city,
      province: account.profile.province,
      referrer: account.user.referrer,
    },
  };

  if (!currentMember || sponsor?.id) {
    memberPayload.sponsor_member_id = sponsor?.id ?? null;
  }

  const memberWrite = currentMember
    ? supabase.from("members").update(memberPayload).eq("id", currentMember.id)
    : supabase.from("members").insert(memberPayload);

  const { error: memberError } = await memberWrite;
  if (memberError) {
    throw new ExternalLoginError("Unable to save the local member account.", "provisioning");
  }
}

/**
 * Post-login re-verification, run after a local-first sign-in has already
 * succeeded. Re-checks the external account and refreshes the mirrored
 * password/profile/member data. If the external system now rejects the
 * credentials (password changed there, or the account was deactivated), the
 * local mirrored password is scrambled so the stale one stops working on the
 * next attempt — on every app, not just the one they signed into.
 */
export async function syncExternalLoginInBackground(username: string, password: string) {
  try {
    await provisionOneGrindersLogin(username, password);
  } catch (error) {
    if (error instanceof ExternalLoginError && error.kind === "credentials") {
      const supabase = createIdentityAdminClient();
      const { data: member } = await supabase
        .from("members")
        .select("profile_id")
        .eq("username", normalizeUsername(username))
        .maybeSingle<{ profile_id: string }>();
      if (member) {
        await supabase.auth.admin.updateUserById(member.profile_id, {
          password: crypto.randomUUID(),
        });
        console.warn("[one-account] revoked stale mirrored password", { username });
      }
    } else {
      // Remote/config hiccup: keep the mirror, the next login re-syncs.
      console.error("[one-account] background sync skipped", error);
    }
  }
}

export async function provisionOneGrindersLogin(
  username: string,
  password: string,
): Promise<ExternalLoginProvisionResult> {
  const account = await verifyExternalCredentials(username, password);
  const normalizedUsername = normalizeUsername(account.user.username || username);
  const supabase = createIdentityAdminClient();

  // Imported members may carry a real auth email, so resolve by username first;
  // the synthetic-email lookup only covers first-time provisioning and legacy rows.
  const profileId = await findProfileIdByUsername(normalizedUsername, supabase);
  const user = profileId
    ? await syncAuthUser(profileId, password, account, supabase)
    : await ensureAuthUser(
        externalEmailForUsername(normalizedUsername),
        password,
        account,
        supabase,
      );

  const email = user.email ?? externalEmailForUsername(normalizedUsername);
  await ensureProfileAndMember(user.id, email, account, supabase);

  return { email, password };
}
