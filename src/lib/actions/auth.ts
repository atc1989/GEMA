"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import {
  ExternalLoginError,
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

  if (!email.includes("@")) {
    try {
      const provisioned = await provisionOneGrindersLogin(email, password);
      email = provisioned.email;
      password = provisioned.password;
    } catch (error) {
      if (error instanceof ExternalLoginError) {
        if (error.kind === "credentials") await recordFailedLogin(identifier);
        return { ok: false, error: error.message };
      }

      return { ok: false, error: "Unable to verify this login right now." };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordFailedLogin(identifier);
    return { ok: false, error: "Invalid email or password." };
  }

  // Honour an explicit guard redirect (e.g. ?redirectTo=/admin/events/...).
  if (parsed.data.redirectTo?.startsWith("/")) {
    redirect(parsed.data.redirectTo);
  }

  // Smart role-based landing.
  const profile = await getCurrentProfile();
  if (profile?.isAdmin) redirect("/admin");
  const ctx = await getCurrentMember();
  redirect(ctx ? "/dashboard" : "/onboarding");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
