import type { EventPosterData } from "./types";

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
