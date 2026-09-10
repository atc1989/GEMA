"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { SLOT_MINUTES, TEAMS_PER_SLOT } from "@/lib/events/slots";
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
import { formatLandingDate, formatLandingTime } from "@/lib/utils/format";
import type { Event } from "@/lib/database/types";
import { asPosterTemplateId } from "@/components/event/posters/types";
import { asPhotoFocus } from "@/components/event/posters/shared";

import { type ActionResult, type FieldErrors } from "@/lib/actions/types";
export type { ActionResult, FieldErrors };

const EVENTS_PATH = "/admin/events";

/** A duplicate lands a week on by default — the common case for a repeat. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  // PGRST204 and friends: the app is ahead of the database. Admin-only screens,
  // so the real cause is far more use than a shrug — this is a migration that
  // has not been applied, not anything the host did wrong.
  const missingColumn = /'([a-z_]+)' column/.exec(message)?.[1];
  if (missingColumn || m.includes("schema cache") || m.includes("does not exist")) {
    return missingColumn
      ? `This database has no "${missingColumn}" column yet — a migration has not been applied. Ask an admin to run the pending SQL.`
      : "This database is missing a column the app expects — a migration has not been applied.";
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

/**
 * The generator's own refusals are written for the host — "this change would
 * strand 3 booked slot(s)" is exactly what someone shortening the window length
 * on a half-booked event needs to read. friendlyDbError would flatten them to a
 * shrug, so they pass straight through.
 */
function schedulingError(message: string): string {
  const m = message.toLowerCase();
  const passThrough = [
    "would strand",
    "shorter than one slot",
    "no arrival windows",
    "working day",
    "day of the week",
    "set an end time",
    "break",
    "slot length",
    "at least one team",
  ];
  // The RAISE text arrives whole, so it is shown whole.
  if (passThrough.some((needle) => m.includes(needle))) return message.trim();
  return friendlyDbError(message, "Could not build the arrival times.");
}

/**
 * Builds or tears down the arrival-slot grid after the event row is saved.
 *
 * generate_event_slots also derives events.capacity from the grid, so it has to
 * run after the row write — the host's Capacity value is overwritten on
 * purpose. It refuses rather than stranding a booked window that the new times
 * would drop, which is why the message is surfaced instead of swallowed.
 */
async function syncEventSlots(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  enabled: boolean,
  breakStart?: string,
  breakEnd?: string,
  slotMinutes?: number,
  teamsPerSlot?: number,
  dayStart?: string,
  dayEnd?: string,
  weekdays?: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (enabled) {
    const { error } = await supabase.rpc("generate_event_slots", {
      p_event_id: eventId,
      p_slot_minutes: slotMinutes ?? SLOT_MINUTES,
      p_seats_per_slot: teamsPerSlot ?? TEAMS_PER_SLOT,
      // Both null runs the day straight through. The schema already refuses a
      // half-set pair, and the RPC refuses it again.
      p_break_start: breakStart ?? null,
      p_break_end: breakEnd ?? null,
      // Null weekdays means every date in the run; the form posts an empty
      // array for that, so it is normalised here rather than in the RPC.
      p_day_start: dayStart ?? null,
      p_day_end: dayEnd ?? null,
      p_weekdays: weekdays && weekdays.length > 0 ? weekdays : null,
    });
    if (error) {
      console.error("generate_event_slots failed:", error.code, error.message);
      return { ok: false, error: schedulingError(error.message) };
    }
    return { ok: true };
  }

  const { error } = await supabase.rpc("disable_event_slots", { p_event_id: eventId });
  if (error) {
    console.error("disable_event_slots failed:", error.code, error.message);
    return { ok: false, error: friendlyDbError(error.message, "Could not turn arrival times off.") };
  }
  return { ok: true };
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

  const slotSync = await syncEventSlots(
    supabase,
    data.id,
    parsed.data.schedulingEnabled,
    parsed.data.breakStart,
    parsed.data.breakEnd,
    parsed.data.slotMinutes,
    parsed.data.teamsPerSlot,
    parsed.data.dayStart,
    parsed.data.dayEnd,
    parsed.data.weekdays,
  );
  if (!slotSync.ok) {
    return { ok: false, error: `Event saved, but ${slotSync.error}` };
  }

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

  const slotSync = await syncEventSlots(
    supabase,
    eventId,
    parsed.data.schedulingEnabled,
    parsed.data.breakStart,
    parsed.data.breakEnd,
    parsed.data.slotMinutes,
    parsed.data.teamsPerSlot,
    parsed.data.dayStart,
    parsed.data.dayEnd,
    parsed.data.weekdays,
  );
  if (!slotSync.ok) {
    return { ok: false, error: `Event saved, but ${slotSync.error}` };
  }

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

/**
 * Copies an event into a fresh draft: the event row, its speakers, its landing
 * page, and its arrival-slot settings.
 *
 * A clinic that repeats is now a new event per occurrence, which keeps each
 * date's registrations and attendance separate by construction. That trade only
 * works if setting up the next one is a button — otherwise it is retyping four
 * clinicians, their licence numbers and a carousel twice a week, and a mistyped
 * licence number on a medical page is not a small mistake.
 *
 * What is deliberately NOT copied: status (always a draft), publication, the
 * pin, cancellation and completion marks, and every registration, slot and
 * attendance record. The copy starts empty.
 */
export async function duplicateEvent(
  eventId: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireAdmin();

  const parsedId = z.string().uuid().safeParse(eventId);
  if (!parsedId.success) return { ok: false, error: "Unknown event." };

  const supabase = await createSupabaseServerClient();

  const { data: source, error: loadError } = await supabase
    .from("events")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle<EventRow>();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!source) return { ok: false, error: "Event not found." };

  let slug: string;
  try {
    slug = await ensureUniqueEventSlug(supabase, source.title);
  } catch {
    return { ok: false, error: "Could not generate a unique link. Try again." };
  }

  // A week on, same time of day. Any repeat needs new dates anyway, and for a
  // weekly clinic this is the answer; the host edits it before publishing.
  const shift = (iso: string | null): string | null =>
    iso ? new Date(new Date(iso).getTime() + WEEK_MS).toISOString() : null;
  const startsAt = shift(source.starts_at) as string;
  const endsAt = shift(source.ends_at);

  // `select *` returns whatever the database actually has, so a missing key
  // means event_slot_scheduling.sql has not been applied here. Naming those
  // columns anyway makes PostgREST reject the whole insert on schema cache,
  // which is how duplicating failed with nothing but a shrug. Duplicating an
  // event has no business waiting on the slots migration.
  const hasScheduling = source.scheduling_enabled !== undefined;
  const schedulingColumns = hasScheduling
    ? {
        scheduling_enabled: source.scheduling_enabled ?? false,
        slot_minutes: source.slot_minutes ?? null,
        teams_per_slot: source.teams_per_slot ?? null,
        break_start: source.break_start ?? null,
        break_end: source.break_end ?? null,
        day_start: source.day_start ?? null,
        day_end: source.day_end ?? null,
        weekdays: source.weekdays ?? null,
      }
    : {};

  const { data: created, error: insertError } = await supabase
    .from("events")
    .insert({
      title: source.title,
      slug,
      event_type: source.event_type,
      visibility: source.visibility,
      mode: source.mode,
      status: "draft",
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: source.timezone,
      venue_name: source.venue_name,
      venue_address: source.venue_address,
      map_url: source.map_url,
      online_url: source.online_url,
      capacity: source.capacity,
      description: source.description,
      banner_url: source.banner_url,
      created_by_profile_id: admin.id,
      // Kept: it is the sponsor fallback for a lead who arrives without a
      // referral code, so dropping it would silently reassign those leads.
      host_member_id: source.host_member_id,
      metadata: source.metadata ?? {},
      // Slot settings ride along; the grid itself is rebuilt below.
      ...schedulingColumns,
    })
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (insertError || !created) {
    return {
      ok: false,
      error: insertError
        ? friendlyDbError(insertError.message, "Could not duplicate the event.")
        : "Could not duplicate the event.",
    };
  }


  const { data: speakers } = await supabase
    .from("event_speakers")
    .select("name, role_title, photo_url, sort_order, profile_id")
    .eq("event_id", parsedId.data)
    .order("sort_order", { ascending: true });

  if (speakers && speakers.length > 0) {
    await supabase
      .from("event_speakers")
      .insert(speakers.map((row) => ({ ...row, event_id: created.id })));
  }

  const landingCopied = await duplicateEventLanding(
    supabase,
    parsedId.data,
    created.id,
    { startsAt, timezone: source.timezone, adminId: admin.id },
  );

  if (hasScheduling && source.scheduling_enabled) {
    const slotSync = await syncEventSlots(
      supabase,
      created.id,
      true,
      source.break_start ?? undefined,
      source.break_end ?? undefined,
      source.slot_minutes ?? undefined,
      source.teams_per_slot ?? undefined,
      source.day_start ?? undefined,
      source.day_end ?? undefined,
      source.weekdays ?? undefined,
    );
    if (!slotSync.ok) {
      // The copy exists and is editable; say what did not come across rather
      // than leaving a half-built draft behind with no explanation.
      revalidatePath(EVENTS_PATH);
      return {
        ok: false,
        error: `Copied the event, but ${slotSync.error} Open the copy and check its arrival times.`,
      };
    }
  }

  revalidatePath(EVENTS_PATH);
  return landingCopied
    ? { ok: true, data: created }
    : {
        ok: false,
        error: "Copied the event, but its landing page did not come across. Open the copy and check.",
      };
}

/**
 * Clones the ginhawa_landing row onto the new event.
 *
 * The date and time labels are display strings tied to the old date, so they
 * are regenerated rather than copied — a duplicate that still advertises last
 * Friday is worse than one with no date at all. The copy is never published:
 * the host reviews it and publishes with the event.
 */
async function duplicateEventLanding(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sourceEventId: string,
  newEventId: string,
  meta: { startsAt: string; timezone: string; adminId: string },
): Promise<boolean> {
  const { data: landing } = await supabase
    .from("ginhawa_landing")
    .select("*")
    .eq("source_event_id", sourceEventId)
    .maybeSingle<Record<string, unknown>>();

  if (!landing) return true; // Nothing to copy is not a failure.

  // Copy everything, then drop what belongs to the original. Deliberately not
  // an allowlist: a landing field added later should ride along by default,
  // and silently dropping one is the worse failure.
  const rest: Record<string, unknown> = { ...landing };
  for (const key of [
    "id",
    "source_event_id",
    "published",
    "published_at",
    "created_at",
    "updated_at",
    "updated_by",
  ]) {
    delete rest[key];
  }

  const { error } = await supabase.from("ginhawa_landing").insert({
    ...rest,
    source_event_id: newEventId,
    date_label: formatLandingDate(meta.startsAt, meta.timezone),
    time_label: formatLandingTime(meta.startsAt, meta.timezone),
    published: false,
    published_at: null,
    updated_by: meta.adminId,
  });

  if (error) {
    console.error("duplicate landing failed:", error.code, error.message);
    return false;
  }
  return true;
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
