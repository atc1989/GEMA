"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/auth/require-member";
import type { ProspectStage } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const updateProspectStageSchema = z.object({
  prospectId: z.string().uuid(),
  stage: z.enum(["new", "registered", "attended", "followup", "expired"]),
});

export async function updateProspectStage(input: {
  prospectId: string;
  stage: ProspectStage;
}): Promise<ActionResult<{ id: string; stage: ProspectStage; lastContactedAt: string | null }>> {
  const ctx = await requireMember();

  if (ctx.member.status !== "active") {
    return { ok: false, error: "Only active members can update prospects." };
  }

  const parsed = updateProspectStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid prospect update." };
  }

  const values = parsed.data;
  const supabase = await createSupabaseServerClient();
  const lastContactedAt = values.stage === "followup" ? new Date().toISOString() : undefined;

  const { data, error } = await supabase
    .from("prospects")
    .update({
      stage: values.stage,
      ...(lastContactedAt ? { last_contacted_at: lastContactedAt } : {}),
    })
    .eq("id", values.prospectId)
    .eq("sponsor_member_id", ctx.member.id)
    .is("converted_member_id", null)
    .select("id, stage, last_contacted_at")
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Could not update prospect. Please try again." };
  }

  if (!data) {
    return { ok: false, error: "Prospect not found or already converted." };
  }

  revalidatePath("/member/prospects");

  return {
    ok: true,
    data: {
      id: data.id,
      stage: data.stage,
      lastContactedAt: data.last_contacted_at,
    },
  };
}
