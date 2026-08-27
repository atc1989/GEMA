import type { GinhawaClinician, GinhawaLanding } from "@/lib/database/types";
import type { GinhawaLandingFormInput } from "@/lib/schemas/ginhawa-landing";
import { formatLandingDate, formatLandingTime } from "@/lib/utils/format";

export const DEFAULT_ASK = {
  askTitle: "When was the last time you saw a doctor?",
  askBody:
    "Lifestyle diseases are rising — from how we eat, how we sleep, how hard we work. But a check up costs money, and that stops many from going.",
  askHit: "So we are giving it free.",
};

export const DEFAULT_GUT = {
  gutTitle: "Why the gut?",
  gutBody:
    "Much of what the body does begins there — digestion, and more besides. Which is why your lifestyle shows up in how you feel.",
  gutClose: "That is a conversation to have with a doctor, not a leaflet.",
};

/** Public GEMA origin used to prefill the Ginhawa Book CTA. Override with GEMA_PUBLIC_ORIGIN. */
export const DEFAULT_GEMA_PUBLIC_ORIGIN = "https://gema-ivory.vercel.app";

export function gemaPublicOrigin(override?: string | null): string {
  return (override || process.env.GEMA_PUBLIC_ORIGIN || DEFAULT_GEMA_PUBLIC_ORIGIN).replace(/\/$/, "");
}

/** Public registration form for an event — the default Book my seat target. */
export function gemaRegisterUrl(eventId: string, origin?: string | null): string {
  if (!eventId) return "";
  return `${gemaPublicOrigin(origin)}/register/${eventId}`;
}

export type GinhawaLandingRow = {
  id: string;
  source_event_id: string;
  template: string;
  title: string;
  date_label: string;
  time_label: string;
  hero_what: string;
  gift_points: number;
  gift_peso: number;
  capacity: number | null;
  clinicians: unknown;
  video_url: string | null;
  video_length: string | null;
  video_caption: string | null;
  ask_title: string;
  ask_body: string;
  ask_hit: string;
  gut_title: string;
  gut_body: string;
  gut_close: string;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  book_url: string | null;
  published: boolean;
  published_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SpeakerPrefill = {
  id: string;
  name: string;
  role_title: string | null;
  photo_url: string | null;
};

export type EventPrefill = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  description: string | null;
  capacity: number | null;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
};

export function initialsFromName(name: string): string {
  const skip = /^(dr|ms|mr|mrs|atty)\.?$/i;
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p && !skip.test(p));
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseClinicians(raw: unknown): GinhawaClinician[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).map((item, i) => {
    const row = asRecord(item) ?? {};
    const name = str(row.name) || "Clinician";
    return {
      id: str(row.id) || `clinician-${i}`,
      name,
      suffix: str(row.suffix),
      role: str(row.role) || str(row.role_title),
      initials: str(row.initials) || initialsFromName(name),
      photo: str(row.photo) || str(row.photo_url) || null,
      licence: str(row.licence),
      credentialsMd: str(row.credentialsMd) || str(row.credentials_md),
    };
  });
}

export function cliniciansToRow(clinicians: GinhawaClinician[]) {
  return clinicians.map((c) => ({
    id: c.id,
    name: c.name,
    suffix: c.suffix,
    role: c.role,
    initials: c.initials || initialsFromName(c.name),
    photo: c.photo,
    licence: c.licence,
    credentials_md: c.credentialsMd,
  }));
}

export function mapLandingRow(row: GinhawaLandingRow): GinhawaLanding {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    template: row.template || "medical",
    title: row.title,
    dateLabel: row.date_label,
    timeLabel: row.time_label,
    heroWhat: row.hero_what,
    giftPoints: row.gift_points,
    giftPeso: row.gift_peso,
    capacity: row.capacity,
    clinicians: parseClinicians(row.clinicians),
    videoUrl: row.video_url,
    videoLength: row.video_length,
    videoCaption: row.video_caption,
    askTitle: row.ask_title,
    askBody: row.ask_body,
    askHit: row.ask_hit,
    gutTitle: row.gut_title,
    gutBody: row.gut_body,
    gutClose: row.gut_close,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    mapUrl: row.map_url,
    bookUrl: row.book_url,
    published: row.published,
    publishedAt: row.published_at,
  };
}

export function speakersToClinicians(speakers: SpeakerPrefill[]): GinhawaClinician[] {
  return speakers.slice(0, 4).map((s) => ({
    id: s.id,
    name: s.name,
    suffix: "",
    role: s.role_title ?? "",
    initials: initialsFromName(s.name),
    photo: s.photo_url,
    licence: "",
    credentialsMd: "",
  }));
}

export function emptyClinician(): GinhawaClinician {
  return {
    id: crypto.randomUUID(),
    name: "",
    suffix: "",
    role: "",
    initials: "",
    photo: null,
    licence: "",
    credentialsMd: "",
  };
}

function clinicianForm(c: GinhawaClinician) {
  return {
    id: c.id,
    name: c.name,
    suffix: c.suffix,
    role: c.role,
    initials: c.initials,
    photo: c.photo ?? "",
    licence: c.licence,
    credentialsMd: c.credentialsMd,
  };
}

export function landingToFormValues(
  landing: GinhawaLanding,
  publicOrigin?: string | null,
): GinhawaLandingFormInput {
  return {
    sourceEventId: landing.sourceEventId,
    title: landing.title,
    dateLabel: landing.dateLabel,
    timeLabel: landing.timeLabel,
    heroWhat: landing.heroWhat,
    giftPoints: landing.giftPoints,
    giftPeso: landing.giftPeso,
    capacity: landing.capacity ?? "",
    clinicians: landing.clinicians.map(clinicianForm),
    videoUrl: landing.videoUrl ?? "",
    videoLength: landing.videoLength ?? "",
    videoCaption: landing.videoCaption ?? "",
    askTitle: landing.askTitle,
    askBody: landing.askBody,
    askHit: landing.askHit,
    gutTitle: landing.gutTitle,
    gutBody: landing.gutBody,
    gutClose: landing.gutClose,
    venueName: landing.venueName ?? "",
    venueAddress: landing.venueAddress ?? "",
    mapUrl: landing.mapUrl ?? "",
    bookUrl: landing.bookUrl || gemaRegisterUrl(landing.sourceEventId, publicOrigin),
  };
}

export function eventToFormValues(
  event: EventPrefill,
  speakers: SpeakerPrefill[],
  copy?: GinhawaLanding | null,
  publicOrigin?: string | null,
): GinhawaLandingFormInput {
  return {
    sourceEventId: event.id,
    title: event.title,
    dateLabel: formatLandingDate(event.starts_at, event.timezone),
    timeLabel: formatLandingTime(event.starts_at, event.timezone),
    heroWhat: event.description ?? "",
    giftPoints: copy?.giftPoints ?? 750,
    giftPeso: copy?.giftPeso ?? 750,
    capacity: event.capacity ?? "",
    clinicians: speakersToClinicians(speakers).map(clinicianForm),
    videoUrl: copy?.videoUrl ?? "",
    videoLength: copy?.videoLength ?? "",
    videoCaption: copy?.videoCaption ?? "",
    askTitle: copy?.askTitle || DEFAULT_ASK.askTitle,
    askBody: copy?.askBody || DEFAULT_ASK.askBody,
    askHit: copy?.askHit || DEFAULT_ASK.askHit,
    gutTitle: copy?.gutTitle || DEFAULT_GUT.gutTitle,
    gutBody: copy?.gutBody || DEFAULT_GUT.gutBody,
    gutClose: copy?.gutClose || DEFAULT_GUT.gutClose,
    venueName: event.venue_name ?? "",
    venueAddress: event.venue_address ?? "",
    mapUrl: event.map_url ?? "",
    bookUrl: gemaRegisterUrl(event.id, publicOrigin),
  };
}
