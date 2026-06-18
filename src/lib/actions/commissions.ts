"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { commissionActionSchema, type CommissionActionInput } from "@/lib/schemas/commission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

type Transition = {
  status: "approved" | "paid" | "reversed";
  timestampColumn: "approved_at" | "paid_at" | "reversed_at";
};

async function transitionCommission(
  input: CommissionActionInput,
  { status, timestampColumn }: Transition,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = commissionActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("commissions")
    .update({ status, [timestampColumn]: new Date().toISOString() })
    .eq("id", parsed.data.commissionId);

  if (error) {
    return { ok: false, error: "Could not update the commission. Please try again." };
  }

  revalidatePath("/admin/commissions");
  return { ok: true };
}

export async function approveCommission(input: CommissionActionInput) {
  return transitionCommission(input, { status: "approved", timestampColumn: "approved_at" });
}

export async function markCommissionPaid(input: CommissionActionInput) {
  return transitionCommission(input, { status: "paid", timestampColumn: "paid_at" });
}

export async function reverseCommission(input: CommissionActionInput) {
  return transitionCommission(input, { status: "reversed", timestampColumn: "reversed_at" });
}

export async function approveAllPending(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("commissions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("status", "pending");
  if (error) return { ok: false, error: "Could not approve commissions. Please try again." };
  revalidatePath("/admin/commissions");
  return { ok: true };
}

export async function markAllApprovedPaid(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("status", "approved");
  if (error) return { ok: false, error: "Could not mark commissions as paid. Please try again." };
  revalidatePath("/admin/commissions");
  return { ok: true };
}
