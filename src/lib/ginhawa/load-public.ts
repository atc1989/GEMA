import { cache } from "react";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { mapsEmbedSrc, resolveGoogleMapsUrl } from "@/lib/ginhawa/maps";
import {
  parseLandingPayload,
  resolveBookUrl,
  type PublicLanding,
} from "@/lib/ginhawa/public-landing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function hydrateLanding(
  raw: unknown,
  ref?: string | null,
): Promise<PublicLanding | null> {
  const landing = parseLandingPayload(raw);
  if (!landing) return null;

  const resolvedMap = await resolveGoogleMapsUrl(landing.mapUrl);
  return {
    ...landing,
    mapEmbedSrc: mapsEmbedSrc(resolvedMap, landing.venueAddress, landing.venueName),
    bookUrl: resolveBookUrl(landing.sourceEventId, landing.bookUrl, ref),
  };
}

/** Published landing for a slug, plus live seats. Deduped per request. */
export const getPublishedLandingBySlug = cache(
  async (slug: string, ref?: string | null): Promise<PublicLanding | null> => {
    const trimmed = slug.trim();
    if (!trimmed) return null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_event_landing_by_slug", {
      p_slug: trimmed,
    });
    if (error || data == null) return null;

    return hydrateLanding(data, ref);
  },
);

/**
 * Host/admin draft preview for a slug (published or unpublished).
 * Returns null when the slug is unknown or the caller cannot manage the event.
 */
export const getPreviewLandingBySlug = cache(
  async (slug: string, ref?: string | null): Promise<PublicLanding | null> => {
    const trimmed = slug.trim();
    if (!trimmed) return null;

    const profile = await getCurrentProfile();
    if (!profile) return null;

    const supabase = await createSupabaseServerClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, slug")
      .eq("slug", trimmed)
      .maybeSingle<{ id: string; slug: string }>();
    if (!event) return null;

    const { data: canManage } = await supabase.rpc("can_manage_event", {
      target_event_id: event.id,
    });
    if (canManage !== true) return null;

    const { data: row } = await supabase
      .from("ginhawa_landing")
      .select("*")
      .eq("source_event_id", event.id)
      .maybeSingle();
    if (!row) return null;

    const { count } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .neq("status", "cancelled");

    const payload = {
      ...row,
      slug: event.slug,
      seats_taken: count ?? 0,
    };

    return hydrateLanding(payload, ref);
  },
);
