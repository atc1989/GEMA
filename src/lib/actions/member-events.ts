"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult, type FieldErrors } from "@/lib/actions/types";
import { requireMember } from "@/lib/auth/require-member";
import { toEventRow } from "@/lib/database/mappers";
import { eventFormSchema, type EventFormInput } from "@/lib/schemas/event";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUniqueEventSlug } from "@/lib/utils/slug";
import { asPosterTemplateId } from "@/components/event/posters/types";

const PATH = "/member/events";

type SpeakerSync = { name?: string; photoUrl?: string };

/**
 * Keeps a single primary speaker row (sort_order 0) in sync with the form's
 * speaker name + photo. Inserts, updates, or removes it as needed. RLS lets the
 * event's host manage speakers (can_manage_event).
 */
async function syncPrimarySpeaker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  { name, photoUrl }: SpeakerSync,
) {
  const trimmedName = name?.trim();
  const hasData = Boolean(trimmedName || photoUrl);

  const { data: existing } = await supabase
    .from("event_speakers")
    .select("id")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!hasData) {
    if (existing) await supabase.from("event_speakers").delete().eq("id", existing.id);
    return;
  }

  const row = { name: trimmedName || "Speaker", photo_url: photoUrl ?? null };
  if (existing) {
    await supabase.from("event_speakers").update(row).eq("id", existing.id);
  } else {
    await supabase.from("event_speakers").insert({ event_id: eventId, sort_order: 0, ...row });
  }
}

export async function createMemberEvent(
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();

  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();

  let slug: string;
  try {
    slug = await ensureUniqueEventSlug(supabase, parsed.data.title);
  } catch {
    return { ok: false, error: "Could not generate a unique slug. Try again." };
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...toEventRow(parsed.data),
      slug,
      status: "draft",
      created_by_profile_id: ctx.profile.id,
      host_member_id: ctx.member.id,
      metadata: {
        speakerName: parsed.data.speakerName ?? null,
        poster_template: asPosterTemplateId(parsed.data.posterTemplate),
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create the event." };
  }

  await syncPrimarySpeaker(supabase, data.id, {
    name: parsed.data.speakerName,
    photoUrl: parsed.data.speakerPhotoUrl,
  });

  revalidatePath(PATH);
  return { ok: true, data: { id: data.id } };
}

export async function updateMemberEvent(
  eventId: string,
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();

  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: loadError } = await supabase
    .from("events")
    .select("id, status, title, slug, host_member_id, metadata")
    .eq("id", eventId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "Event not found." };
  if (existing.host_member_id !== ctx.member.id) {
    return { ok: false, error: "You can only edit events you host." };
  }
  if (existing.status === "cancelled") {
    return { ok: false, error: "Cancelled events can no longer be edited." };
  }

  let slug = existing.slug as string;
  if (existing.title !== parsed.data.title) {
    try {
      slug = await ensureUniqueEventSlug(supabase, parsed.data.title, eventId);
    } catch {
      return { ok: false, error: "Could not generate a unique slug. Try again." };
    }
  }

  const { error } = await supabase
    .from("events")
    .update({
      ...toEventRow(parsed.data),
      slug,
      metadata: {
        ...((existing.metadata as Record<string, unknown> | null) ?? {}),
        speakerName: parsed.data.speakerName ?? null,
        poster_template: asPosterTemplateId(parsed.data.posterTemplate),
      },
    })
    .eq("id", eventId);

  if (error) return { ok: false, error: error.message };

  await syncPrimarySpeaker(supabase, eventId, {
    name: parsed.data.speakerName,
    photoUrl: parsed.data.speakerPhotoUrl,
  });

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${eventId}`);
  return { ok: true, data: { id: eventId } };
}
