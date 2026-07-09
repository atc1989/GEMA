"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDailyHealthService } from "@/features/gutguard-daily/services/create-daily-health-service";
import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const doseSchema = z.object({
  doseDate: z.string().min(1),
  slot: z.enum(["morning", "midday", "dreams"]),
  capsules: z.coerce.number().int().min(0).max(3),
  status: z.enum(["scheduled", "taken", "skipped", "missed"]),
  notes: z.string().max(500).optional(),
});

const reminderSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.enum(["morning", "midday", "dreams", "general"]),
  channel: z.enum(["in_app", "push", "sms", "messenger", "viber", "call"]),
  localTime: z.string().min(1),
  timezone: z.string().min(1).default("Asia/Manila"),
  enabled: z.coerce.boolean().default(false),
});

const onboardingSchema = z.object({
  currentStep: z.string().min(1),
  tier: z.coerce.number().int().min(1).max(4),
  defaultChannel: z.enum(["in_app", "push", "sms", "messenger", "viber", "call"]),
  completedSteps: z.array(z.string()).default([]),
});

const journeyMessageSchema = z.object({
  id: z.string().uuid().optional(),
  protocolDay: z.coerce.number().int().min(0).max(365).optional(),
  messageType: z.string().min(1).max(80),
  channel: z.enum(["in_app", "push", "sms", "messenger", "viber", "call"]),
  body: z.string().min(1).max(1200),
  scheduledFor: z.string().optional(),
});

const careRelationshipSchema = z.object({
  caregiverId: z.string().uuid(),
  canRecordDoses: z.coerce.boolean().default(false),
  canManageReminders: z.coerce.boolean().default(false),
});

const teamSchema = z.object({
  name: z.string().min(2).max(120),
});

async function getService() {
  const supabase = await createSupabaseServerClient();
  return createDailyHealthService(supabase);
}

function revalidateGutGuard() {
  revalidatePath("/gutguard-daily");
  revalidatePath("/gutguard-daily/tracker");
  revalidatePath("/gutguard-daily/reminders");
  revalidatePath("/gutguard-daily/onboarding");
  revalidatePath("/gutguard-daily/journey");
  revalidatePath("/gutguard-daily/community");
  revalidatePath("/admin/gutguard");
}

export async function recordGutGuardDoseAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/tracker");
  const parsed = doseSchema.safeParse({
    doseDate: formData.get("doseDate"),
    slot: formData.get("slot"),
    capsules: formData.get("capsules"),
    status: formData.get("status"),
    notes: formData.get("notes")?.toString() || undefined,
  });

  if (!parsed.success) return;

  const service = await getService();
  await service.recordDose({
    patient_id: ctx.profile.id,
    recorded_by: ctx.profile.id,
    dose_date: parsed.data.doseDate,
    slot: parsed.data.slot,
    capsules: parsed.data.capsules,
    status: parsed.data.status,
    taken_at: parsed.data.status === "taken" ? new Date().toISOString() : null,
    notes: parsed.data.notes ?? null,
  });

  revalidateGutGuard();
}

export async function saveGutGuardReminderAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/reminders");
  const parsed = reminderSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    slot: formData.get("slot"),
    channel: formData.get("channel"),
    localTime: formData.get("localTime"),
    timezone: formData.get("timezone")?.toString() || "Asia/Manila",
    enabled: formData.get("enabled") === "on",
  });

  if (!parsed.success) return;

  const service = await getService();
  const payload = {
    patient_id: ctx.profile.id,
    created_by: ctx.profile.id,
    slot: parsed.data.slot === "general" ? null : parsed.data.slot,
    channel: parsed.data.channel,
    local_time: parsed.data.localTime,
    timezone: parsed.data.timezone,
    enabled: parsed.data.enabled,
  };

  if (parsed.data.id) {
    await service.changeReminder(parsed.data.id, payload);
  } else {
    await service.createReminder(payload);
  }

  revalidateGutGuard();
}

export async function deleteGutGuardReminderAction(formData: FormData) {
  await requireMember("/gutguard-daily/reminders");
  const id = formData.get("id")?.toString();
  if (!id) return;

  const service = await getService();
  await service.deleteReminder(id);
  revalidateGutGuard();
}

export async function saveGutGuardOnboardingAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/onboarding");
  const parsed = onboardingSchema.safeParse({
    currentStep: formData.get("currentStep"),
    tier: formData.get("tier"),
    defaultChannel: formData.get("defaultChannel"),
    completedSteps: formData.getAll("completedSteps").map(String),
  });

  if (!parsed.success) return;

  const isComplete = parsed.data.currentStep === "complete";
  const service = await getService();
  await service.saveOnboardingProgress({
    patient_id: ctx.profile.id,
    current_step: parsed.data.currentStep,
    completed_steps: parsed.data.completedSteps,
    tier: parsed.data.tier,
    default_channel: parsed.data.defaultChannel,
    completed_at: isComplete ? new Date().toISOString() : null,
  });

  revalidateGutGuard();
}

export async function saveGutGuardJourneyMessageAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/journey");
  const parsed = journeyMessageSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    protocolDay: formData.get("protocolDay")?.toString() || undefined,
    messageType: formData.get("messageType"),
    channel: formData.get("channel"),
    body: formData.get("body"),
    scheduledFor: formData.get("scheduledFor")?.toString() || undefined,
  });

  if (!parsed.success) return;

  const service = await getService();
  const payload = {
    patient_id: ctx.profile.id,
    assigned_to: ctx.profile.id,
    created_by: ctx.profile.id,
    protocol_day: parsed.data.protocolDay ?? null,
    message_type: parsed.data.messageType,
    channel: parsed.data.channel,
    body: parsed.data.body,
    scheduled_for: parsed.data.scheduledFor || null,
  };

  if (parsed.data.id) {
    await service.changeJourneyMessage(parsed.data.id, payload);
  } else {
    await service.createJourneyMessage(payload);
  }

  revalidateGutGuard();
}

export async function dismissGutGuardJourneyMessageAction(formData: FormData) {
  await requireMember("/gutguard-daily/journey");
  const id = formData.get("id")?.toString();
  if (!id) return;

  const service = await getService();
  await service.changeJourneyMessage(id, { status: "dismissed" });
  revalidateGutGuard();
}

export async function createGutGuardCareRelationshipAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/community");
  const parsed = careRelationshipSchema.safeParse({
    caregiverId: formData.get("caregiverId"),
    canRecordDoses: formData.get("canRecordDoses") === "on",
    canManageReminders: formData.get("canManageReminders") === "on",
  });

  if (!parsed.success) return;

  const service = await getService();
  await service.createCareRelationship({
    patient_id: ctx.profile.id,
    caregiver_id: parsed.data.caregiverId,
    created_by: ctx.profile.id,
    status: "pending",
    can_view_doses: true,
    can_record_doses: parsed.data.canRecordDoses,
    can_manage_reminders: parsed.data.canManageReminders,
  });

  revalidateGutGuard();
}

export async function createGutGuardTeamAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/community");
  const parsed = teamSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return;

  const service = await getService();
  await service.createTeam({
    name: parsed.data.name,
    lead_id: ctx.profile.id,
    created_by: ctx.profile.id,
  });

  revalidateGutGuard();
}
