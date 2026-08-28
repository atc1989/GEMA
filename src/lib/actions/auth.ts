"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import {
  createLoginEngine,
  emailForUsername,
  isSyntheticExternalEmail,
  normalizeIdentifier,
} from "@/lib/one-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign-in behaviour lives in `@/lib/one-account` so Lifestyle and Academy do
 * the same thing with the same credentials (Change 2). This file is GEMA's
 * half: the form contract and where a member lands afterwards.
 */
const loginEngine = createLoginEngine({
  getSessionClient: createSupabaseServerClient,
  getClientIp: async () => {
    const requestHeaders = await headers();
    return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  },
  runAfterResponse: after,
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
  const outcome = await loginEngine.signIn({
    identifier: String(formData.get("identifier") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!outcome.ok) {
    // The 6-digit code step is a Staging template quirk the spokes handle.
    // Production Auth still emails a confirmation link, so pointing a GEMA
    // member at a code box would be a dead end.
    if (outcome.needsEmailConfirm) {
      return {
        ok: false,
        error: "Confirm your email from the message we sent, then sign in.",
      };
    }
    return { ok: false, error: outcome.error };
  }

  const redirectTo = formData.get("redirectTo");
  await redirectAfterLogin(
    typeof redirectTo === "string" ? redirectTo : undefined,
    outcome.backupLogin,
  );
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
  const identifier = normalizeIdentifier(String(formData.get("identifier") ?? ""));
  if (!identifier) return { ok: false, message: "Enter your username or email." };

  const email = identifier.includes("@")
    ? identifier
    : await emailForUsername(identifier);

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
