"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult } from "@/lib/actions/types";
import { requireMember } from "@/lib/auth/require-member";
import { toEventRow } from "@/lib/database/mappers";
import { memberEventFormSchema, type EventFormInput } from "@/lib/schemas/event";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUniqueEventSlug } from "@/lib/utils/slug";
import { asPosterTemplateId } from "@/components/event/posters/types";
import { asPhotoFocus } from "@/components/event/posters/shared";

const PATH = "/member/events";

/** Maps raw database errors to messages safe to show users; logs the original. */
function friendlyDbError(message: string, fallback = "Something went wrong. Please try again."): string {
  console.error("[member-events]", message);
  const m = message.toLowerCase();
  if (m.includes("events_slug_key") || m.includes("duplicate key")) {
    return "An event with a similar title already exists. Please adjust the title and try again.";
  }
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("not authorized")) {
    return "You do not have permission to do that.";
  }
  return fallback;
}

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
  await requireMember();

  const parsed = memberEventFormSchema.safeParse(input);
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

  const row = toEventRow(parsed.data);
  const { data, error } = await supabase.rpc("create_member_event", {
    p_title: row.title,
    p_slug: slug,
    p_event_type: row.event_type,
    p_visibility: row.visibility,
    p_mode: row.mode,
    p_starts_at: row.starts_at,
    p_ends_at: row.ends_at,
    p_timezone: row.timezone,
    p_venue_name: row.venue_name,
    p_venue_address: row.venue_address,
    p_map_url: row.map_url,
    p_online_url: row.online_url,
    p_capacity: row.capacity,
    p_description: row.description,
    p_banner_url: row.banner_url,
    p_speaker_name: parsed.data.speakerName ?? null,
    p_speaker_photo_url: parsed.data.speakerPhotoUrl ?? null,
    p_poster_template: asPosterTemplateId(parsed.data.posterTemplate),
    p_photo_focus: asPhotoFocus(parsed.data.photoFocus),
  });

  if (error || !data) {
    return {
      ok: false,
      error: error ? friendlyDbError(error.message, "Failed to create the event.") : "Failed to create the event.",
    };
  }

  revalidatePath(PATH);
  return { ok: true, data: { id: data } };
}

export async function updateMemberEvent(
  eventId: string,
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireMember();

  const parsed = memberEventFormSchema.safeParse(input);
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

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
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
        photo_focus: asPhotoFocus(parsed.data.photoFocus),
      },
    })
    .eq("id", eventId);

  if (error) return { ok: false, error: friendlyDbError(error.message, "Failed to update the event.") };

  await syncPrimarySpeaker(supabase, eventId, {
    name: parsed.data.speakerName,
    photoUrl: parsed.data.speakerPhotoUrl,
  });

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${eventId}`);
  return { ok: true, data: { id: eventId } };
}
