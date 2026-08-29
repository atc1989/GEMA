/** Landing media: up to three slides per section, each a video or an image. */

export type LandingMedia = { url: string; caption: string };

export type MediaEmbed = { kind: "drive" | "video" | "image"; src: string; caption: string };

/** Max slides in one carousel. Kept here so schema, form, and render agree. */
export const MAX_LANDING_MEDIA = 3;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i;

/**
 * Turns a Drive share link into an embed URL; other https URLs play as
 * <video>, or render as <img> when the path looks like an image file.
 */
export function resolveMedia(url: string | null | undefined, caption = ""): MediaEmbed | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const fileId =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  if (fileId && /(?:drive|docs)\.google\.com/i.test(trimmed)) {
    return { kind: "drive", src: `https://drive.google.com/file/d/${fileId}/preview`, caption };
  }
  return { kind: IMAGE_EXT.test(trimmed) ? "image" : "video", src: trimmed, caption };
}

/** Trims a stored/submitted media list to the slides that actually have a URL. */
export function cleanMedia(raw: readonly LandingMedia[] | null | undefined): LandingMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => ({ url: (m?.url ?? "").trim(), caption: (m?.caption ?? "").trim() }))
    .filter((m) => m.url)
    .slice(0, MAX_LANDING_MEDIA);
}

type LegacyVideo = {
  media: LandingMedia[];
  videoUrl: string | null;
  videoCaption: string | null;
};

/**
 * Media list for a landing. Rows saved before the carousel existed keep their
 * single video, so the legacy columns are the fallback — not a second source
 * of truth. Editing such a landing writes it back into `media`.
 */
export function landingMedia(landing: LegacyVideo): LandingMedia[] {
  if (landing.media.length) return landing.media;
  return cleanMedia([{ url: landing.videoUrl ?? "", caption: landing.videoCaption ?? "" }]);
}

/** Renderable carousel slides for a landing. */
export function landingSlides(landing: LegacyVideo): MediaEmbed[] {
  return landingMedia(landing)
    .map((m) => resolveMedia(m.url, m.caption))
    .filter((m): m is MediaEmbed => m !== null);
}
