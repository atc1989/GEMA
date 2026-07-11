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
  locale: z.enum(["en", "tl", "bis"]).default("en"),
  enabled: z.coerce.boolean().default(false),
});

const dosingConfigSchema = z.object({
  product: z.string().min(1).max(120),
  totalCapsules: z.coerce.number().int().min(1).max(2000),
  capsulesPerDay: z.coerce.number().int().min(1).max(9),
  startDate: z.string().min(1),
  locale: z.enum(["en", "tl", "bis"]).default("en"),
});

const onboardingCompletionSchema = z.object({
  tier: z.coerce.number().int().min(1).max(4),
  locale: z.enum(["en", "tl", "bis"]),
  stock: z.coerce.number().int().min(1).max(2000),
  daysTaken: z.coerce.number().int().min(0).max(365),
  caregiverConsent: z.coerce.boolean().default(false),
  notificationsEnabled: z.coerce.boolean().default(false),
  slots: z
    .array(
      z.object({
        slot: z.enum(["morning", "midday", "dreams"]),
        capsules: z.number().int().min(1).max(3),
        time: z.string().min(1),
      }),
    )
    .min(1),
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
    locale: formData.get("locale")?.toString() || "en",
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
    locale: parsed.data.locale,
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

export async function saveGutGuardDosingConfigAction(formData: FormData) {
  const ctx = await requireMember("/gutguard-daily/tracker");
  const parsed = dosingConfigSchema.safeParse({
    product: formData.get("product"),
    totalCapsules: formData.get("totalCapsules"),
    capsulesPerDay: formData.get("capsulesPerDay"),
    startDate: formData.get("startDate"),
    locale: formData.get("locale")?.toString() || "en",
  });

  if (!parsed.success) return;

  const service = await getService();
  await service.saveDosingConfig({
    patient_id: ctx.profile.id,
    product: parsed.data.product,
    total_capsules: parsed.data.totalCapsules,
    capsules_per_day: parsed.data.capsulesPerDay,
    start_date: parsed.data.startDate,
    locale: parsed.data.locale,
  });

  revalidateGutGuard();
}

/** One-shot completion of the onboarding flow: dosing config, per-slot
 *  reminders, onboarding progress, and the first recorded dose. */
export async function completeGutGuardOnboardingAction(
  input: z.input<typeof onboardingCompletionSchema>,
) {
  const ctx = await requireMember("/gutguard-daily/onboarding");
  const parsed = onboardingCompletionSchema.safeParse(input);
  if (!parsed.success) return;

  const { tier, locale, stock, daysTaken, caregiverConsent, notificationsEnabled, slots } =
    parsed.data;
  const service = await getService();
  const now = new Date();

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysTaken);
  const toIsoDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  await service.saveDosingConfig({
    patient_id: ctx.profile.id,
    product: "SynBIOTIC+ · Start",
    total_capsules: stock,
    capsules_per_day: slots.reduce((sum, s) => sum + s.capsules, 0),
    start_date: toIsoDate(startDate),
    locale,
  });

  // ponytail: recreates slot reminders on each completion instead of diffing;
  // onboarding runs once, and duplicates are visible/deletable on Reminders.
  const existing = await service.getReminders(ctx.profile.id);
  for (const slot of slots) {
    const match = existing.data?.find((reminder) => reminder.slot === slot.slot);
    const payload = {
      patient_id: ctx.profile.id,
      created_by: ctx.profile.id,
      slot: slot.slot,
      channel: notificationsEnabled ? ("push" as const) : ("in_app" as const),
      local_time: slot.time,
      timezone: "Asia/Manila",
      locale,
      enabled: true,
    };
    if (match) await service.changeReminder(match.id, payload);
    else await service.createReminder(payload);
  }

  await service.saveOnboardingProgress({
    patient_id: ctx.profile.id,
    current_step: "complete",
    completed_steps: ["profile", "dosing", "reminders", "consent"],
    tier,
    default_channel: notificationsEnabled ? "push" : "in_app",
    consent_caregiver_at: caregiverConsent ? now.toISOString() : null,
    completed_at: now.toISOString(),
  });

  await service.recordDose({
    patient_id: ctx.profile.id,
    recorded_by: ctx.profile.id,
    dose_date: toIsoDate(now),
    slot: slots[0].slot,
    capsules: slots[0].capsules,
    status: "taken",
    taken_at: now.toISOString(),
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
