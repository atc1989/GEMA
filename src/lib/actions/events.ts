"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { mapEventRow, toEventRow, type EventRow } from "@/lib/database/mappers";
import {
  cancelEventSchema,
  eventFormSchema,
  publishReadinessSchema,
  type EventFormInput,
} from "@/lib/schemas/event";
import {
  publishEventLanding,
  syncEventLandingFromForm,
  unpublishEventLanding,
} from "@/lib/ginhawa/sync-landing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUniqueEventSlug } from "@/lib/utils/slug";
import type { Event } from "@/lib/database/types";
import { asPosterTemplateId } from "@/components/event/posters/types";
import { asPhotoFocus } from "@/components/event/posters/shared";

import { type ActionResult, type FieldErrors } from "@/lib/actions/types";
export type { ActionResult, FieldErrors };

const EVENTS_PATH = "/admin/events";

/** Maps raw database errors to messages safe to show users; logs the original. */
function friendlyDbError(message: string, fallback = "Something went wrong. Please try again."): string {
  console.error("[events]", message);
  const m = message.toLowerCase();
  if (m.includes("events_slug_key") || m.includes("duplicate key")) {
    return "An event with a similar title already exists. Please adjust the title and try again.";
  }
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "You do not have permission to do that.";
  }
  return fallback;
}

type SpeakerSync = { name?: string; photoUrl?: string };

async function syncPrimarySpeaker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  { name, photoUrl }: SpeakerSync,
) {
  const trimmedName = name?.trim();
  const cleanPhotoUrl = photoUrl?.trim();
  const hasData = Boolean(trimmedName || cleanPhotoUrl);

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

  const row = { name: trimmedName || "Speaker", photo_url: cleanPhotoUrl || null };
  if (existing) {
    await supabase.from("event_speakers").update(row).eq("id", existing.id);
  } else {
    await supabase.from("event_speakers").insert({ event_id: eventId, sort_order: 0, ...row });
  }
}

/** Creates a draft event owned by the current admin. */
export async function createEvent(
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

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
      created_by_profile_id: admin.id,
      metadata: {
        speakerName: parsed.data.speakerName ?? null,
        poster_template: asPosterTemplateId(parsed.data.posterTemplate),
        photo_focus: asPhotoFocus(parsed.data.photoFocus),
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error ? friendlyDbError(error.message, "Failed to create the event.") : "Failed to create the event.",
    };
  }

  await syncPrimarySpeaker(supabase, data.id, {
    name: parsed.data.speakerName,
    photoUrl: parsed.data.speakerPhotoUrl,
  });

  const eventRow = toEventRow(parsed.data);
  const landingSync = await syncEventLandingFromForm(
    supabase,
    data.id,
    {
      title: eventRow.title,
      startsAt: eventRow.starts_at,
      timezone: eventRow.timezone,
      description: eventRow.description,
      capacity: eventRow.capacity,
      venueName: eventRow.venue_name,
      venueAddress: eventRow.venue_address,
      mapUrl: eventRow.map_url,
      publish: false,
    },
    parsed.data.landing,
    admin.id,
  );
  if (!landingSync.ok) {
    return {
      ok: false,
      error: "Event saved, but the landing page could not be saved. Edit the event to retry.",
    };
  }

  revalidatePath(EVENTS_PATH);
  return { ok: true, data: { id: data.id } };
}

/** Updates an existing event. Cancelled events are read-only. */
export async function updateEvent(
  eventId: string,
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

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
    .select("id, status, title, slug, metadata")
    .eq("id", eventId)
    .maybeSingle();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!existing) return { ok: false, error: "Event not found." };
  if (existing.status === "cancelled") {
    return { ok: false, error: "Cancelled events can no longer be edited." };
  }

  // Regenerate the slug only when the title changes.
  let slug = existing.slug;
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

  const eventRow = toEventRow(parsed.data);
  const landingSync = await syncEventLandingFromForm(
    supabase,
    eventId,
    {
      title: eventRow.title,
      startsAt: eventRow.starts_at,
      timezone: eventRow.timezone,
      description: eventRow.description,
      capacity: eventRow.capacity,
      venueName: eventRow.venue_name,
      venueAddress: eventRow.venue_address,
      mapUrl: eventRow.map_url,
      publish: existing.status === "published",
    },
    parsed.data.landing,
    admin.id,
  );
  if (!landingSync.ok) {
    return {
      ok: false,
      error: "Event saved, but the landing page could not be saved. Try again.",
    };
  }

  revalidatePath(EVENTS_PATH);
  revalidatePath(`${EVENTS_PATH}/${eventId}`);
  if (existing.slug) revalidatePath(`/e/${existing.slug}`);
  return { ok: true, data: { id: eventId } };
}

/** Publishes a draft event after a stricter readiness check. */
export async function publishEvent(eventId: string): Promise<ActionResult<Event>> {
  const admin = await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const { data: row, error: loadError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!row) return { ok: false, error: "Event not found." };
  if (row.status === "cancelled") {
    return { ok: false, error: "Cancelled events cannot be published." };
  }
  if (row.status === "published") {
    return { ok: true, data: mapEventRow(row) };
  }

  const readiness = publishReadinessSchema.safeParse({
    title: row.title,
    eventType: row.event_type,
    visibility: row.visibility,
    mode: row.mode,
    startsAt: row.starts_at,
    venueName: row.venue_name,
    onlineUrl: row.online_url,
    description: row.description,
  });

  if (!readiness.success) {
    return {
      ok: false,
      error: readiness.error.issues[0]?.message ?? "Event is not ready to publish.",
    };
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status: "published" })
    .eq("id", eventId)
    .select("*")
    .single<EventRow>();

  if (error || !data) {
    return {
      ok: false,
      error: error ? friendlyDbError(error.message, "Failed to publish the event.") : "Failed to publish the event.",
    };
  }

  const landingPub = await publishEventLanding(supabase, eventId, admin.id);
  if (!landingPub.ok) {
    return {
      ok: false,
      error: "Event published, but the landing page could not be published. Open Landings to retry.",
    };
  }

  revalidatePath(EVENTS_PATH);
  revalidatePath(`${EVENTS_PATH}/${eventId}`);
  revalidatePath("/admin/ginhawa");
  if (data.slug) revalidatePath(`/e/${data.slug}`);
  return { ok: true, data: mapEventRow(data) };
}

/** Pins or unpins an event so it can be surfaced at the top of the events list. */
export async function toggleEventPin(
  eventId: string,
  pinned: boolean,
): Promise<ActionResult<{ pinnedAt: string | null }>> {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const pinnedAt = pinned ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("events")
    .update({ pinned_at: pinnedAt })
    .eq("id", eventId);

  if (error) return { ok: false, error: friendlyDbError(error.message, "Failed to update pin.") };

  revalidatePath(EVENTS_PATH);
  return { ok: true, data: { pinnedAt } };
}

/** Statuses an archived event can be restored to; anything else falls back to draft. */
const RESTORABLE_STATUSES: Event["status"][] = ["draft", "published", "cancelled", "completed"];

/**
 * Archives or restores an event. Archiving remembers the pre-archive status in
 * metadata so restoring puts the event back where it was, and clears the pin so
 * an archived event can't keep holding the top of the list.
 */
export async function setEventArchived(
  eventId: string,
  archived: boolean,
): Promise<ActionResult<{ status: Event["status"] }>> {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const { data: row, error: loadError } = await supabase
    .from("events")
    .select("id, status, metadata")
    .eq("id", eventId)
    .maybeSingle<{
      id: string;
      status: Event["status"];
      metadata: Record<string, unknown> | null;
    }>();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!row) return { ok: false, error: "Event not found." };
  if (archived === (row.status === "archived")) return { ok: true, data: { status: row.status } };

  const { archive, ...metadata } = row.metadata ?? {};
  const previous = (archive as { from?: Event["status"] } | undefined)?.from;

  const patch = archived
    ? {
        status: "archived" as const,
        pinned_at: null,
        metadata: { ...metadata, archive: { from: row.status, at: new Date().toISOString() } },
      }
    : {
        status: previous && RESTORABLE_STATUSES.includes(previous) ? previous : ("draft" as const),
        metadata,
      };

  const { error } = await supabase.from("events").update(patch).eq("id", eventId);

  if (error) {
    return {
      ok: false,
      error: friendlyDbError(
        error.message,
        archived ? "Failed to archive the event." : "Failed to restore the event.",
      ),
    };
  }

  revalidatePath(EVENTS_PATH);
  revalidatePath(`${EVENTS_PATH}/${eventId}`);
  return { ok: true, data: { status: patch.status } };
}

/** Cancels an event and records the reason + timestamp. */
export async function cancelEvent(
  eventId: string,
  input: { reason: string },
): Promise<ActionResult<Event>> {
  const admin = await requireAdmin();

  const parsed = cancelEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: row, error: loadError } = await supabase
    .from("events")
    .select("id, status, slug, metadata")
    .eq("id", eventId)
    .maybeSingle<{
      id: string;
      status: Event["status"];
      slug: string;
      metadata: Record<string, unknown>;
    }>();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!row) return { ok: false, error: "Event not found." };
  if (row.status === "cancelled") {
    return { ok: false, error: "This event is already cancelled." };
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      metadata: {
        ...(row.metadata ?? {}),
        cancellation: { reason: parsed.data.reason, at: new Date().toISOString() },
      },
    })
    .eq("id", eventId)
    .select("*")
    .single<EventRow>();

  if (error || !data) {
    return {
      ok: false,
      error: error ? friendlyDbError(error.message, "Failed to cancel the event.") : "Failed to cancel the event.",
    };
  }

  await unpublishEventLanding(supabase, eventId, admin.id);

  revalidatePath(EVENTS_PATH);
  revalidatePath(`${EVENTS_PATH}/${eventId}`);
  revalidatePath("/admin/ginhawa");
  if (row.slug) revalidatePath(`/e/${row.slug}`);
  return { ok: true, data: mapEventRow(data) };
}
