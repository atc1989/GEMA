"use server";

import { z } from "zod";

import { requireMember } from "@/lib/auth/require-member";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function changePassword(
  input: ChangePasswordInput,
): Promise<ActionResult<void>> {
  await requireMember();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}
