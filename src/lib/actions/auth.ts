"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  redirectTo: z.string().optional(),
});

export type LoginResult = { ok: false; error: string } | undefined;

/**
 * Signs an admin in with email + password. On success the session cookies are
 * written and the user is redirected; on failure an error message is returned
 * for the form to display.
 */
export async function loginAction(
  _prev: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
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
