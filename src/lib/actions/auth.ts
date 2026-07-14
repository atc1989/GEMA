"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import {
  ExternalLoginError,
  isSyntheticExternalEmail,
  provisionOneGrindersLogin,
} from "@/lib/integrations/onegrinders-login";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const THROTTLE_MAX_FAILURES = 5;
const THROTTLE_WINDOW_MINUTES = 15;

async function clientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** True when the identifier has too many recent failures to try again. */
async function isThrottled(identifier: string) {
  const since = new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await createSupabaseAdminClient()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username", identifier)
    .gte("created_at", since);
  // ponytail: per-identifier only; add a per-IP cap if bots rotate usernames.
  return !error && (count ?? 0) >= THROTTLE_MAX_FAILURES;
}

/** Fire-and-forget: a logging failure must never block a login. */
async function recordFailedLogin(identifier: string) {
  await createSupabaseAdminClient()
    .from("login_attempts")
    .insert({ username: identifier, client_ip: await clientIp() });
}

/**
 * Backup path for when the external login API is unreachable: resolve a
 * username to its local auth email so we can try the mirrored password.
 */
async function fallbackEmailForUsername(username: string) {
  const admin = createSupabaseAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("profile_id")
    .eq("username", username)
    .maybeSingle<{ profile_id: string }>();
  if (!member) return null;

  const { data } = await admin.auth.admin.getUserById(member.profile_id);
  return data.user?.email ?? null;
}

const BACKUP_WRONG_PASSWORD =
  "Our main login service is temporarily offline. Please try the password you originally " +
  "registered with the guild. If that doesn't work, use “Forgot password?” or contact your admin.";
const BACKUP_NO_ACCOUNT =
  "Login is temporarily offline for new members. Please try again in a while, " +
  "or contact your admin to get access now.";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required."),
  password: z.string().min(1, "Password is required."),
  redirectTo: z.string().optional(),
});

export type LoginResult = { ok: false; error: string } | undefined;

/**
 * Signs a local email user or verified external username into the Supabase
 * session used by the app's RLS policies and protected routes.
 */
export async function loginAction(
  _prev: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  let email = parsed.data.identifier.trim();
  let password = parsed.data.password;
  const identifier = email.toLowerCase();

  if (await isThrottled(identifier)) {
    return {
      ok: false,
      error: `Too many failed attempts. Please wait ${THROTTLE_WINDOW_MINUTES} minutes and try again.`,
    };
  }

  let backupLogin = false;

  if (!email.includes("@")) {
    try {
      const provisioned = await provisionOneGrindersLogin(email, password);
      email = provisioned.email;
      password = provisioned.password;
    } catch (error) {
      if (error instanceof ExternalLoginError && error.kind === "remote") {
        // External API unreachable — try the locally mirrored password instead.
        const fallbackEmail = await fallbackEmailForUsername(identifier);
        if (!fallbackEmail) {
          return { ok: false, error: BACKUP_NO_ACCOUNT };
        }
        email = fallbackEmail;
        backupLogin = true;
      } else if (error instanceof ExternalLoginError) {
        if (error.kind === "credentials") await recordFailedLogin(identifier);
        return { ok: false, error: error.message };
      } else {
        return { ok: false, error: "Unable to verify this login right now." };
      }
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordFailedLogin(identifier);
    return {
      ok: false,
      error: backupLogin ? BACKUP_WRONG_PASSWORD : "Invalid email or password.",
    };
  }

  // Surfaces the "backup access" banner on the landing page.
  const withBackup = (path: string) =>
    backupLogin ? `${path}${path.includes("?") ? "&" : "?"}backup=1` : path;

  // Honour an explicit guard redirect (e.g. ?redirectTo=/admin/events/...).
  if (parsed.data.redirectTo?.startsWith("/")) {
    redirect(withBackup(parsed.data.redirectTo));
  }

  // Smart role-based landing.
  const profile = await getCurrentProfile();
  if (profile?.isAdmin) redirect(withBackup("/admin"));
  const ctx = await getCurrentMember();
  redirect(withBackup(ctx ? "/dashboard" : "/onboarding"));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const NO_EMAIL_ON_FILE = "No email on file for this account. Please contact your admin.";

export type ResetRequestResult = { ok: boolean; message: string } | undefined;

export async function requestPasswordResetAction(
  _prev: ResetRequestResult,
  formData: FormData,
): Promise<ResetRequestResult> {
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  if (!identifier) return { ok: false, message: "Enter your username or email." };

  const email = identifier.includes("@")
    ? identifier
    : await fallbackEmailForUsername(identifier);

  if (!email || isSyntheticExternalEmail(email)) {
    return { ok: false, message: NO_EMAIL_ON_FILE };
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ?? `https://${requestHeaders.get("host") ?? ""}`;

  const supabase = await createSupabaseServerClient();
  // Ignore errors: never reveal whether an email has an account.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  return { ok: true, message: "If an email is on file, a password reset link has been sent." };
}

export type ResetPasswordResult = { ok: false; error: string } | undefined;

export async function resetPasswordAction(
  _prev: ResetPasswordResult,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await createSupabaseServerClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: "Could not update the password. Request a new reset link." };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
