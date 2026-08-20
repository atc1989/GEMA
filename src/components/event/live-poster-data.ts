import type { EventPosterData } from "@/components/event/posters/types";

/** Placeholders on the member Create event form — the poster uses the same
 *  copy when those fields are still empty so the preview matches what you see. */
export const MEMBER_POSTER_FALLBACKS = {
  title: "Saturday Sizzle",
  venueName: "Davao Hub Center",
} as const;

export const ADMIN_POSTER_FALLBACKS = {
  title: "Business Presentation Night",
  venueName: "Davao Hub Center",
} as const;

/** Live banner data: typed values win; empty fields reuse the form placeholders. */
export function livePosterData({
  title,
  eventType,
  mode,
  startsAt,
  venueName,
  venueAddress,
  speakerName,
  speakerPhotoUrl,
  photoFocus,
  fallbackTitle,
  fallbackVenue,
}: {
  title?: string;
  eventType?: string;
  mode: EventPosterData["mode"];
  startsAt?: string;
  venueName?: string;
  venueAddress?: string;
  speakerName?: string;
  speakerPhotoUrl?: string;
  photoFocus?: EventPosterData["photoFocus"];
  fallbackTitle: string;
  fallbackVenue: string;
}): EventPosterData {
  const trimmedTitle = String(title ?? "").trim();
  const trimmedVenue = String(venueName ?? "").trim();
  return {
    title: trimmedTitle || fallbackTitle,
    eventType,
    mode,
    startsAt: startsAt || undefined,
    venueName: mode === "online" ? undefined : trimmedVenue || fallbackVenue,
    venueAddress: venueAddress || undefined,
    speakerName: speakerName || undefined,
    speakerPhotoUrl,
    photoFocus,
  };
}
