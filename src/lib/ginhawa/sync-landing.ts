import { cliniciansToRow, gemaRegisterUrl } from "@/lib/ginhawa/prefill";
import type { EventLandingFieldsValues } from "@/lib/schemas/event";
import { formatLandingDate, formatLandingTime } from "@/lib/utils/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type LandingEventSnapshot = {
  title: string;
  startsAt: string;
  timezone: string;
  description?: string | null;
  capacity?: number | null;
  venueName?: string | null;
  venueAddress?: string | null;
  mapUrl?: string | null;
  /** When true, landing is published with the event. */
  publish: boolean;
};

/**
 * Upserts (or unpublishes) the medical landing for an event from create/edit form data.
 * Title/date/venue/capacity are taken from the event snapshot, not duplicated in landing fields.
 */
export async function syncEventLandingFromForm(
  supabase: Supabase,
  eventId: string,
  event: LandingEventSnapshot,
  landing: EventLandingFieldsValues | undefined,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!landing?.enabled) {
    // Toggle off: hide any existing landing; keep the row for later re-enable.
    const { error } = await supabase
      .from("ginhawa_landing")
      .update({ published: false, updated_by: updatedBy })
      .eq("source_event_id", eventId);
    if (error && !/0 rows|no rows/i.test(error.message)) {
      // Ignore "no row" — nothing to unpublish.
      const { data: existing } = await supabase
        .from("ginhawa_landing")
        .select("id")
        .eq("source_event_id", eventId)
        .maybeSingle();
      if (existing) {
        return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  }

  const clinicians = (landing.clinicians ?? []).filter((c) => c.name?.trim());
  const now = new Date().toISOString();
  const publish = Boolean(event.publish);

  const { data: existing } = await supabase
    .from("ginhawa_landing")
    .select("published_at")
    .eq("source_event_id", eventId)
    .maybeSingle<{ published_at: string | null }>();

  const row = {
    source_event_id: eventId,
    template: "medical" as const,
    title: event.title,
    date_label: formatLandingDate(event.startsAt, event.timezone),
    time_label: formatLandingTime(event.startsAt, event.timezone),
    hero_what: (landing.heroWhat || event.description || "").trim(),
    gift_points: landing.giftPoints,
    gift_peso: landing.giftPeso,
    capacity: event.capacity ?? null,
    clinicians: cliniciansToRow(
      clinicians.map((c) => ({
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
    video_url: landing.videoUrl ?? null,
    video_length: landing.videoLength || null,
    video_caption: landing.videoCaption || null,
    ask_title: landing.askTitle ?? "",
    ask_body: landing.askBody ?? "",
    ask_hit: landing.askHit ?? "",
    gut_title: landing.gutTitle ?? "",
    gut_body: landing.gutBody ?? "",
    gut_close: landing.gutClose ?? "",
    venue_name: event.venueName ?? null,
    venue_address: event.venueAddress ?? null,
    map_url: event.mapUrl ?? null,
    book_url: gemaRegisterUrl(eventId),
    published: publish,
    published_at: publish ? existing?.published_at ?? now : null,
    updated_by: updatedBy,
  };

  const { error } = await supabase
    .from("ginhawa_landing")
    .upsert(row, { onConflict: "source_event_id" });

  if (error) {
    console.error("[sync-event-landing]", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Marks a landing published when its event is published. No-op if no landing row. */
export async function publishEventLanding(
  supabase: Supabase,
  eventId: string,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("ginhawa_landing")
    .select("id, published_at")
    .eq("source_event_id", eventId)
    .maybeSingle<{ id: string; published_at: string | null }>();

  if (!existing) return { ok: true };

  const { error } = await supabase
    .from("ginhawa_landing")
    .update({
      published: true,
      published_at: existing.published_at ?? now,
      updated_by: updatedBy,
    })
    .eq("source_event_id", eventId);

  if (error) {
    console.error("[publish-event-landing]", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Hides a landing when its event is cancelled/unpublished. */
export async function unpublishEventLanding(
  supabase: Supabase,
  eventId: string,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from("ginhawa_landing")
    .select("id")
    .eq("source_event_id", eventId)
    .maybeSingle();

  if (!existing) return { ok: true };

  const { error } = await supabase
    .from("ginhawa_landing")
    .update({ published: false, updated_by: updatedBy })
    .eq("source_event_id", eventId);

  if (error) {
    console.error("[unpublish-event-landing]", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
