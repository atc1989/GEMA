"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import {
  ExternalLoginError,
  provisionOneGrindersLogin,
} from "@/lib/integrations/onegrinders-login";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (!email.includes("@")) {
    try {
      const provisioned = await provisionOneGrindersLogin(email, password);
      email = provisioned.email;
      password = provisioned.password;
    } catch (error) {
      if (error instanceof ExternalLoginError) {
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
