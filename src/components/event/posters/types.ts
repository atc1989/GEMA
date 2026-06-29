import type { ForwardRefExoticComponent, RefAttributes } from "react";

/** Data a poster template renders from. Kept backward-compatible with the
 *  original EventPoster shape; `speakerPhotoUrl` is optional and only used by
 *  photo-forward templates (e.g. Spotlight). */
export type EventPosterData = {
  title: string;
  eventType?: string;
  mode: "in_person" | "online" | "hybrid";
  startsAt?: string;
  venueName?: string;
  speakerName?: string;
  speakerPhotoUrl?: string;
  /** Host-chosen pan/zoom framing for the photo (see shared.ts PhotoFocus). */
  photoFocus?: { x: number; y: number; zoom: number };
};

export const POSTER_TEMPLATE_IDS = [
  "aurora",
  "boldType",
  "editorial",
  "spotlight",
  "showcase",
  "framed",
  "postcard",
] as const;
export type PosterTemplateId = (typeof POSTER_TEMPLATE_IDS)[number];

export const DEFAULT_POSTER_TEMPLATE: PosterTemplateId = "aurora";

/** Narrows an arbitrary string (e.g. from metadata) to a valid template id. */
export function asPosterTemplateId(value: unknown): PosterTemplateId {
  return POSTER_TEMPLATE_IDS.includes(value as PosterTemplateId)
    ? (value as PosterTemplateId)
    : DEFAULT_POSTER_TEMPLATE;
}

/** All templates share this contract: a forwardRef div rendered at the canvas size. */
export type PosterComponent = ForwardRefExoticComponent<
  { data: EventPosterData } & RefAttributes<HTMLDivElement>
>;
