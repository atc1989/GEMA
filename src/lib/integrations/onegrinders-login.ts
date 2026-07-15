import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LOGIN_ENDPOINT =
  process.env.ONEGRINDERS_LOGIN_URL ?? "https://onegrindersguild.ph/api/v1/auth/login.php";
const EXTERNAL_EMAIL_DOMAIN = "onegrindersguild.local";

type ExternalLoginUser = {
  id: number;
  role_id: number;
  username: string;
  profile_photo: string | null;
  referrer: string | null;
  status: string;
  created_at: string | null;
};

type ExternalLoginProfile = {
  id: number;
  username: string;
  full_name: string | null;
  display_name: string | null;
  rank_title: string | null;
  city: string | null;
  province: string | null;
};

type ExternalLoginAccount = {
  user: ExternalLoginUser;
  profile: ExternalLoginProfile;
};

type ExternalLoginResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    authenticated?: boolean;
    account?: ExternalLoginAccount;
  };
};

export type ExternalLoginProvisionResult = {
  email: string;
  password: string;
};

export class ExternalLoginError extends Error {
  constructor(
    message: string,
    public readonly kind: "configuration" | "credentials" | "remote" | "provisioning",
  ) {
    super(message);
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function externalEmailForUsername(username: string) {
  const safeUsername = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "-");
  return `${safeUsername}@${EXTERNAL_EMAIL_DOMAIN}`;
}

/** Synthetic addresses can't receive mail (no reset links, no notifications). */
export function isSyntheticExternalEmail(email: string) {
  return email.toLowerCase().endsWith(`@${EXTERNAL_EMAIL_DOMAIN}`);
}

function memberCodeForExternalUser(userId: number) {
  return `OGG-${String(userId).padStart(6, "0")}`;
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function profilePhotoUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, "https://onegrindersguild.ph").toString();
}

function externalTimestamp(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function verifyExternalCredentials(username: string, password: string) {
  const apiKey = process.env.ONEGRINDERS_API_KEY;
  if (!apiKey) {
    throw new ExternalLoginError(
      "External login is not configured. Add ONEGRINDERS_API_KEY on the server.",
      "configuration",
    );
  }

  let response: Response;
  try {
    response = await fetch(LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ username: normalizeUsername(username), password }),
      cache: "no-store",
      // A slow external API must fail over to the local backup path, not hang logins.
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ExternalLoginError("Login service is temporarily unavailable.", "remote");
  }

  let data: ExternalLoginResponse | null = null;
  try {
    data = (await response.json()) as ExternalLoginResponse;
  } catch {
    throw new ExternalLoginError("Login service returned an invalid response.", "remote");
  }

  if (response.status === 401) {
    throw new ExternalLoginError("Invalid username or password.", "credentials");
  }

  if (!response.ok || !data?.ok || !data.data?.authenticated || !data.data.account) {
    throw new ExternalLoginError(data?.message ?? "Login verification failed.", "remote");
  }

  const account = data.data.account;
  if (normalizeStatus(account.user.status) !== "ACTIVE") {
    throw new ExternalLoginError("This external account is not active.", "credentials");
  }

  return account;
}

/**
 * Members imported via the admin uploader (or upgraded with a real email) are
 * found by username, not by the synthetic email — their auth email may be real.
 */
async function findProfileIdByUsername(username: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("members")
    .select("profile_id")
    .eq("username", username)
    .maybeSingle<{ profile_id: string }>();

  if (error) {
    throw new ExternalLoginError("Unable to inspect local member accounts.", "provisioning");
  }
  return data?.profile_id ?? null;
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createSupabaseAdminClient();
  const perPage = 100;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new ExternalLoginError("Unable to inspect local auth users.", "provisioning");
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  return null;
}

function externalUserMetadata(account: ExternalLoginAccount) {
  return {
    provider: "onegrindersguild",
    external_user_id: account.user.id,
    external_profile_id: account.profile.id,
    username: account.user.username,
    full_name:
      account.profile.full_name?.trim() ||
      account.profile.display_name?.trim() ||
      account.user.username,
  };
}

/**
 * Mirrors the member's verified external password onto the local auth user so
 * GEMA can still sign them in when the external API is down.
 */
async function syncAuthUser(profileId: string, password: string, account: ExternalLoginAccount) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(profileId, {
    password,
    user_metadata: externalUserMetadata(account),
  });
  if (error || !data.user) {
    throw new ExternalLoginError("Unable to update the local auth user.", "provisioning");
  }
  return data.user;
}

async function ensureAuthUser(email: string, password: string, account: ExternalLoginAccount) {
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (profile?.id) {
    return syncAuthUser(profile.id, password, account);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
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
  console.error("[onegrinders-login] createUser failed", { email, detail });

  const existing = await findAuthUserByEmail(email);
  if (!existing) {
    throw new ExternalLoginError(`Unable to create the local auth user (${detail}).`, "provisioning");
  }

  return syncAuthUser(existing.id, password, account);
}

async function ensureProfileAndMember(userId: string, email: string, account: ExternalLoginAccount) {
  const admin = createSupabaseAdminClient();
  const username = normalizeUsername(account.user.username || account.profile.username);
  const fullName =
    account.profile.full_name?.trim() ||
    account.profile.display_name?.trim() ||
    account.user.username;

  // Keep a real email (set by the admin import) — only fill it when missing.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string | null }>();

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email: existingProfile?.email ?? email,
    full_name: fullName,
    avatar_url: profilePhotoUrl(account.user.profile_photo),
    role: "member",
    is_admin: false,
    last_seen_at: new Date().toISOString(),
  });
  if (profileError) {
    throw new ExternalLoginError("Unable to save the local profile.", "provisioning");
  }

  const { data: usernameOwner, error: usernameError } = await admin
    .from("members")
    .select("profile_id")
    .eq("username", username)
    .maybeSingle<{ profile_id: string }>();

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
    ? await admin
        .from("members")
        .select("id")
        .eq("username", normalizeUsername(account.user.referrer))
        .maybeSingle<{ id: string }>()
    : { data: null, error: null };

  if (sponsorError) {
    throw new ExternalLoginError("Unable to inspect the external referrer account.", "provisioning");
  }

  const { data: currentMember, error: memberLookupError } = await admin
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
    ? admin.from("members").update(memberPayload).eq("id", currentMember.id)
    : admin.from("members").insert(memberPayload);

  const { error: memberError } = await memberWrite;
  if (memberError) {
    throw new ExternalLoginError("Unable to save the local member account.", "provisioning");
  }
}

/**
 * Post-login re-verification, run via next/server `after()` once a local-first
 * sign-in has already succeeded. Re-checks the external account and refreshes
 * the mirrored password/profile/member data. If the external system now rejects
 * the credentials (password changed there, or the account was deactivated), the
 * local mirrored password is scrambled so the stale one stops working on the
 * next attempt — the user must then sign in with their current external password.
 */
export async function syncExternalLoginInBackground(username: string, password: string) {
  try {
    await provisionOneGrindersLogin(username, password);
  } catch (error) {
    if (error instanceof ExternalLoginError && error.kind === "credentials") {
      const admin = createSupabaseAdminClient();
      const { data: member } = await admin
        .from("members")
        .select("profile_id")
        .eq("username", normalizeUsername(username))
        .maybeSingle<{ profile_id: string }>();
      if (member) {
        await admin.auth.admin.updateUserById(member.profile_id, {
          password: crypto.randomUUID(),
        });
        console.warn("[onegrinders-login] revoked stale mirrored password", { username });
      }
    } else {
      // Remote/config hiccup: keep the mirror, the next login re-syncs.
      console.error("[onegrinders-login] background sync skipped", error);
    }
  }
}

export async function provisionOneGrindersLogin(
  username: string,
  password: string,
): Promise<ExternalLoginProvisionResult> {
  const account = await verifyExternalCredentials(username, password);
  const normalizedUsername = normalizeUsername(account.user.username || username);

  // Imported members may carry a real auth email, so resolve by username first;
  // the synthetic-email lookup only covers first-time provisioning and legacy rows.
  const profileId = await findProfileIdByUsername(normalizedUsername);
  const user = profileId
    ? await syncAuthUser(profileId, password, account)
    : await ensureAuthUser(externalEmailForUsername(normalizedUsername), password, account);

  const email = user.email ?? externalEmailForUsername(normalizedUsername);
  await ensureProfileAndMember(user.id, email, account);

  return { email, password };
}
