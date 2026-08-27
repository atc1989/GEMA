import { cache } from "react";

import { mapsEmbedSrc, resolveGoogleMapsUrl } from "@/lib/ginhawa/maps";
import {
  parseLandingPayload,
  resolveBookUrl,
  type PublicLanding,
} from "@/lib/ginhawa/public-landing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Published medical landing for a slug, plus live seats. Deduped per request. */
export const getPublishedLandingBySlug = cache(
  async (slug: string, ref?: string | null): Promise<PublicLanding | null> => {
    const trimmed = slug.trim();
    if (!trimmed) return null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_event_landing_by_slug", {
      p_slug: trimmed,
    });
    if (error || data == null) return null;

    const landing = parseLandingPayload(data);
    if (!landing) return null;

    const resolvedMap = await resolveGoogleMapsUrl(landing.mapUrl);
    return {
      ...landing,
      mapEmbedSrc: mapsEmbedSrc(resolvedMap, landing.venueAddress, landing.venueName),
      bookUrl: resolveBookUrl(landing.sourceEventId, landing.bookUrl, ref),
    };
  },
);
