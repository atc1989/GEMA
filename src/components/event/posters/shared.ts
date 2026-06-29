import type { CSSProperties } from "react";

import type { EventPosterData } from "./types";

/** Host-photo framing: pan (x/y %) + zoom, set by the host via the adjuster. */
export type PhotoFocus = { x: number; y: number; zoom: number };

/** Default framing = center-top cover (head-safe), no zoom. */
export const DEFAULT_PHOTO_FOCUS: PhotoFocus = { x: 50, y: 0, zoom: 1 };

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/** Narrows arbitrary input (e.g. metadata) to a valid, clamped PhotoFocus. */
export function asPhotoFocus(value: unknown): PhotoFocus {
  const v = (value ?? {}) as Partial<PhotoFocus>;
  return {
    x: clamp(Number(v.x ?? 50), 0, 100),
    y: clamp(Number(v.y ?? 0), 0, 100),
    zoom: clamp(Number(v.zoom ?? 1), 1, 3),
  };
}

/**
 * Style for a full-bleed host photo. Fills the panel (cover) and applies the
 * host's chosen pan + zoom. Export-safe (plain CSS transforms, no library).
 */
export function hostPhotoStyle(focus?: PhotoFocus): CSSProperties {
  const f = focus ?? DEFAULT_PHOTO_FOCUS;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
    display: "block",
  };
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAYS = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

export type PosterDate = {
  hasDate: boolean;
  month: string;
  day: number | "";
  dow: string;
  time: string;
};

export function posterDate(startsAt?: string): PosterDate {
  const d = startsAt && !Number.isNaN(Date.parse(startsAt)) ? new Date(startsAt) : null;
  if (!d) return { hasDate: false, month: "", day: "", dow: "", time: "" };
  return {
    hasDate: true,
    month: MONTHS[d.getMonth()] ?? "",
    day: d.getDate(),
    dow: DAYS[d.getDay()] ?? "",
    time: d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function posterVenue(data: EventPosterData): string {
  return data.mode === "online" ? "Online Event" : data.venueName || "Venue TBA";
}

export function posterInitials(name?: string): string {
  if (!name) return "G";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Canvas size shared by every template: rendered at 360×450, exported ×3 → 1080×1350. */
export const POSTER_W = 360;
export const POSTER_H = 450;
