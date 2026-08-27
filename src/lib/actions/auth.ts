"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import {
  isSyntheticExternalEmail,
  provisionOneGrindersLogin,
  syncExternalLoginInBackground,
} from "@/lib/integrations/onegrinders-login";
import {
  normalizeIdentifier,
  passwordSignInError,
  resolveSharedLogin,
  THROTTLE_MAX_FAILURES,
  THROTTLE_WINDOW_MINUTES,
} from "@/lib/one-account/login-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required."),
  password: z.string().min(1, "Password is required."),
  redirectTo: z.string().optional(),
});

async function clientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** True when the identifier has too many recent failures to try again. */
async function isThrottled(identifier: string) {
  try {
    const since = new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
    const { count, error } = await createSupabaseAdminClient()
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", identifier)
      .gte("created_at", since);
    // ponytail: per-identifier only; add a per-IP cap if bots rotate usernames.
    return !error && (count ?? 0) >= THROTTLE_MAX_FAILURES;
  } catch {
    // Missing service role or login_attempts table must never block sign-in.
    return false;
  }
}

/** Fire-and-forget: a logging failure must never block a login. */
async function recordFailedLogin(identifier: string) {
  try {
    await createSupabaseAdminClient()
      .from("login_attempts")
      .insert({ username: identifier, client_ip: await clientIp() });
  } catch {
    // Ignore missing table/key — throttle is best-effort.
  }
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
  const identifier = normalizeIdentifier(parsed.data.identifier);
  const resolved = await resolveSharedLogin(
    parsed.data.identifier,
    parsed.data.password,
    {
      isThrottled,
      recordFailedLogin,
      lookupEmailByUsername: fallbackEmailForUsername,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return !error;
      },
      provisionOneGrinders: provisionOneGrindersLogin,
    },
  );

  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  if (resolved.backgroundSync) {
    after(() =>
      syncExternalLoginInBackground(
        resolved.backgroundSync!.username,
        resolved.backgroundSync!.password,
      ),
    );
  }

  if (resolved.phase === "password") {
    const { error } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password: resolved.password,
    });
    if (error) {
      await recordFailedLogin(identifier);
      return { ok: false, error: passwordSignInError(resolved.backupLogin) };
    }
  }

  await redirectAfterLogin(parsed.data.redirectTo, resolved.backupLogin);
}

/** Post-sign-in landing: honours an explicit redirect, then routes by role. */
async function redirectAfterLogin(
  redirectTo: string | undefined,
  backupLogin: boolean,
): Promise<never> {
  // Surfaces the "backup access" banner on the landing page.
  const withBackup = (path: string) =>
    backupLogin ? `${path}${path.includes("?") ? "&" : "?"}backup=1` : path;

  // Honour an explicit guard redirect (e.g. ?redirectTo=/admin/events/...).
  revalidatePath("/", "layout");
  if (redirectTo?.startsWith("/")) {
    redirect(withBackup(redirectTo));
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
