/** Landing media: up to three slides per section, each a video or an image. */

/** What a slide is. Stored at upload time so render never has to guess. */
export type MediaKind = "video" | "image";

export type LandingMedia = {
  url: string;
  caption: string;
  /** Set by the uploader from the real file type. Absent on pasted URLs. */
  kind?: MediaKind;
  /** Poster frame for a video. Without one the slide is a black box. */
  poster?: string;
};

export type MediaEmbed = {
  kind: "drive" | MediaKind;
  src: string;
  caption: string;
  poster?: string;
};

/** Max slides in one carousel. Kept here so schema, form, and render agree. */
export const MAX_LANDING_MEDIA = 3;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i;

/** Drive file id from any of the share-link shapes Google hands out. */
function driveFileId(url: string): string | null {
  if (!/(?:drive|docs)\.google\.com/i.test(url)) return null;
  return (
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ??
    null
  );
}

/**
 * Resolves one slide for render.
 *
 * A stored `kind` always wins — it came from the uploaded file's real MIME
 * type. The extension sniff is only the fallback for a URL somebody pasted,
 * where a CDN link with no extension used to be assumed to be video and
 * rendered an image inside a broken <video>.
 */
export function resolveMedia(
  media: LandingMedia | string | null | undefined,
  captionFallback = "",
): MediaEmbed | null {
  const item: LandingMedia =
    typeof media === "string"
      ? { url: media, caption: captionFallback }
      : media ?? { url: "", caption: captionFallback };

  const url = item.url?.trim();
  if (!url) return null;
  const caption = item.caption?.trim() || captionFallback;

  const fileId = driveFileId(url);
  if (fileId) {
    return { kind: "drive", src: `https://drive.google.com/file/d/${fileId}/preview`, caption };
  }

  const kind: MediaKind = item.kind ?? (IMAGE_EXT.test(url) ? "image" : "video");
  return { kind, src: url, caption, poster: item.poster?.trim() || undefined };
}

/** Trims a stored/submitted media list to the slides that actually have a URL. */
export function cleanMedia(raw: readonly LandingMedia[] | null | undefined): LandingMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      const item: LandingMedia = {
        url: (m?.url ?? "").trim(),
        caption: (m?.caption ?? "").trim(),
      };
      if (m?.kind === "video" || m?.kind === "image") item.kind = m.kind;
      const poster = (m?.poster ?? "").trim();
      if (poster) item.poster = poster;
      return item;
    })
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
    .map((m) => resolveMedia(m))
    .filter((m): m is MediaEmbed => m !== null);
}
