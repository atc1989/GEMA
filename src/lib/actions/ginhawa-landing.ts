"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  cliniciansToRow,
  eventToFormValues,
  landingToFormValues,
  mapLandingRow,
  type EventPrefill,
  type GinhawaLandingRow,
  type SpeakerPrefill,
} from "@/lib/ginhawa/prefill";
import {
  ginhawaLandingFormSchema,
  type GinhawaLandingFormInput,
} from "@/lib/schemas/ginhawa-landing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult, FieldErrors } from "@/lib/actions/types";

export type { ActionResult, FieldErrors };

const GINHAWA_PATH = "/admin/ginhawa";

function friendlyDbError(message: string, fallback = "Something went wrong. Please try again."): string {
  console.error("[ginhawa-landing]", message);
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "You do not have permission to do that.";
  }
  if (m.includes("foreign key") || m.includes("source_event_id")) {
    return "That event is no longer available. Pick another event.";
  }
  return fallback;
}

/** Upserts the singleton landing row and marks it published. */
export async function publishGinhawaLanding(
  input: GinhawaLandingFormInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = ginhawaLandingFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("ginhawa_landing").upsert({
    id: true,
    source_event_id: v.sourceEventId,
    title: v.title,
    date_label: v.dateLabel,
    time_label: v.timeLabel,
    hero_what: v.heroWhat ?? "",
    gift_points: v.giftPoints,
    gift_peso: v.giftPeso,
    capacity: v.capacity ?? null,
    clinicians: cliniciansToRow(
      v.clinicians.map((c) => ({
        id: c.id,
        name: c.name,
        suffix: c.suffix ?? "",
        role: c.role ?? "",
        initials: c.initials ?? "",
        photo: c.photo ?? null,
        licence: c.licence ?? "",
        credentialsMd: c.credentialsMd ?? "",
      })),
    ),
    video_url: v.videoUrl ?? null,
    video_length: v.videoLength || null,
    video_caption: v.videoCaption || null,
    ask_title: v.askTitle ?? "",
    ask_body: v.askBody ?? "",
    ask_hit: v.askHit ?? "",
    gut_title: v.gutTitle ?? "",
    gut_body: v.gutBody ?? "",
    gut_close: v.gutClose ?? "",
    venue_name: v.venueName ?? null,
    venue_address: v.venueAddress ?? null,
    map_url: v.mapUrl ?? null,
    published: true,
    published_at: now,
    updated_by: admin.id,
  });

  if (error) {
    return { ok: false, error: friendlyDbError(error.message, "Failed to publish the landing page.") };
  }

  revalidatePath(GINHAWA_PATH);
  return { ok: true, data: undefined };
}

/** Hides the landing from Ginhawa without deleting the snapshot. */
export async function unpublishGinhawaLanding(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: loadError } = await supabase
    .from("ginhawa_landing")
    .select("id")
    .eq("id", true)
    .maybeSingle<Pick<GinhawaLandingRow, "id">>();

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!existing) return { ok: true, data: undefined };

  const { error } = await supabase
    .from("ginhawa_landing")
    .update({ published: false })
    .eq("id", true);

  if (error) {
    return { ok: false, error: friendlyDbError(error.message, "Failed to unpublish the landing page.") };
  }

  revalidatePath(GINHAWA_PATH);
  return { ok: true, data: undefined };
}

/** Prefills the Ginhawa form from an event without a page navigation. */
export async function prefillGinhawaLanding(
  eventId: string,
): Promise<ActionResult<{ values: GinhawaLandingFormInput; eventTitle: string }>> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, error: "That event is no longer available. Pick another event." };
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: event, error: eventError }, { data: speakers }, { data: landingRow }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, starts_at, timezone, description, capacity, venue_name, venue_address, map_url",
        )
        .eq("id", eventId)
        .maybeSingle<EventPrefill>(),
      supabase
        .from("event_speakers")
        .select("id, name, role_title, photo_url")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .returns<SpeakerPrefill[]>(),
      supabase.from("ginhawa_landing").select("*").eq("id", true).maybeSingle<GinhawaLandingRow>(),
    ]);

  if (eventError) return { ok: false, error: friendlyDbError(eventError.message) };
  if (!event) return { ok: false, error: "Event not found." };

  const landing = landingRow ? mapLandingRow(landingRow) : null;
  const values =
    landing?.sourceEventId === event.id
      ? landingToFormValues(landing)
      : eventToFormValues(event, speakers ?? [], landing);

  return { ok: true, data: { values, eventTitle: event.title } };
}
