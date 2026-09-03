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
  isCompleteEmailCode,
  isSyntheticExternalEmail,
  normalizeEmailCode,
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

  // Deliberately vague about whether the address exists, and deliberately
  // vague about link vs code: this project's template sends one, Staging's
  // sends the other, and the member is told how to finish either way.
  return {
    ok: true,
    message:
      "If an email is on file, a reset is on its way. It may be a link or a 6-digit code.",
  };
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

  // A reset arrives one of two ways and the app has to take both.
  //
  // The Reset Password template on this project emails a 6-digit code, not a
  // link — the same partner template that made Staging's Confirm signup send a
  // code. exchangeCodeForSession cannot consume a 6-digit OTP, so before this
  // there was no way to finish a reset at all: the link path had nothing to
  // exchange and the code path had no handler.
  //
  // Typing the code also sidesteps the second failure. A link points at
  // ${origin}/reset-password, and on a protected preview host that lands the
  // member on Vercel's login wall instead of the app. A code needs no redirect.
  const email = String(formData.get("email") ?? "").trim();

  if (isCompleteEmailCode(code)) {
    if (!email) {
      return { ok: false, error: "Enter the email address you asked the reset for." };
    }
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: normalizeEmailCode(code),
      type: "recovery",
    });
    if (error) {
      return { ok: false, error: "That code did not work. Ask for a new one." };
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
    }
  } else {
    return { ok: false, error: "Enter the 6-digit code from your reset email." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: "Could not update the password. Request a new reset link." };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
