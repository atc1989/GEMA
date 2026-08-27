"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  cliniciansToRow,
  type GinhawaLandingRow,
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
  if (m.includes("ginhawa_landing_source_event") || m.includes("unique")) {
    return "A landing for this event already exists. Refresh and try again.";
  }
  return fallback;
}

function landingRowFromForm(
  v: z.output<typeof ginhawaLandingFormSchema>,
  adminId: string,
  published: boolean,
  publishedAt: string | null,
  template: string,
) {
  return {
    source_event_id: v.sourceEventId,
    template,
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
    book_url: v.bookUrl ?? null,
    published,
    published_at: publishedAt,
    updated_by: adminId,
  };
}

/** Upserts the per-event landing row and marks it published. */
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

  // Look up slug for revalidation; preserve template if the row already exists.
  const [{ data: event }, { data: existing }] = await Promise.all([
    supabase
      .from("events")
      .select("slug")
      .eq("id", v.sourceEventId)
      .maybeSingle<{ slug: string }>(),
    supabase
      .from("ginhawa_landing")
      .select("template")
      .eq("source_event_id", v.sourceEventId)
      .maybeSingle<{ template: string | null }>(),
  ]);

  const template = existing?.template || "medical";

  const { error } = await supabase.from("ginhawa_landing").upsert(
    landingRowFromForm(v, admin.id, true, now, template),
    { onConflict: "source_event_id" },
  );

  if (error) {
    return { ok: false, error: friendlyDbError(error.message, "Failed to publish the landing page.") };
  }

  revalidatePath(GINHAWA_PATH);
  revalidatePath(`${GINHAWA_PATH}/${v.sourceEventId}`);
  if (event?.slug) revalidatePath(`/e/${event.slug}`);
  return { ok: true, data: undefined };
}

/** Hides one event's landing without deleting the snapshot. */
export async function unpublishGinhawaLanding(
  sourceEventId: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(sourceEventId).success) {
    return { ok: false, error: "Invalid event." };
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: existing, error: loadError }, { data: event }] = await Promise.all([
    supabase
      .from("ginhawa_landing")
      .select("id, source_event_id")
      .eq("source_event_id", sourceEventId)
      .maybeSingle<Pick<GinhawaLandingRow, "id" | "source_event_id">>(),
    supabase
      .from("events")
      .select("slug")
      .eq("id", sourceEventId)
      .maybeSingle<{ slug: string }>(),
  ]);

  if (loadError) return { ok: false, error: friendlyDbError(loadError.message) };
  if (!existing) return { ok: true, data: undefined };

  const { error } = await supabase
    .from("ginhawa_landing")
    .update({ published: false })
    .eq("source_event_id", sourceEventId);

  if (error) {
    return { ok: false, error: friendlyDbError(error.message, "Failed to unpublish the landing page.") };
  }

  revalidatePath(GINHAWA_PATH);
  revalidatePath(`${GINHAWA_PATH}/${sourceEventId}`);
  if (event?.slug) revalidatePath(`/e/${event.slug}`);
  return { ok: true, data: undefined };
}
