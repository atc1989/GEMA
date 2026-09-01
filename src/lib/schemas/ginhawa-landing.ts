import { z } from "zod";

import { MAX_LANDING_MEDIA } from "@/lib/ginhawa/media";
import { LANDING_TEMPLATES } from "@/lib/ginhawa/templates";

// Every "optional" field below has to survive an empty string as well as a
// missing key: a hidden `register()`ed input mounts with value "", and rows
// loaded from Postgres arrive with null. Either one used to fail the parse
// and, for the hidden fields, fail it where no error is ever rendered.
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : undefined));

const optionalLenientUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => {
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .refine((v) => v === undefined || z.string().url().safeParse(v).success, {
    message: "Enter a valid URL, or leave blank.",
  });

const optionalCapacity = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
    message: "Capacity must be a positive whole number.",
  });

const nonNegInt = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === undefined || v === "") return NaN;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => Number.isInteger(v) && v >= 0, {
    message: "Enter a whole number of 0 or more.",
  });

/**
 * Slide kind. Only the uploader sets it, so a pasted URL, a legacy row, and a
 * slide the host has not uploaded to yet all reach the parser as "" or null —
 * none of which is a bare `.optional()` enum.
 */
const optionalMediaKind = z
  .union([z.enum(["video", "image"]), z.literal("")])
  .nullish()
  .transform((v) => (v === "video" || v === "image" ? v : undefined));

/** One carousel slide. Blank rows are allowed in the form and dropped on save. */
export const landingMediaSchema = z.object({
  url: optionalLenientUrl,
  caption: z.string().trim().max(240).default(""),
  // Both are set by the uploader, not typed by hand: `kind` comes from the
  // file's real MIME type, `poster` from the frame grabbed at upload.
  kind: optionalMediaKind,
  poster: optionalLenientUrl,
});

export const landingMediaListSchema = z
  .array(landingMediaSchema)
  .max(MAX_LANDING_MEDIA, `At most ${MAX_LANDING_MEDIA} items.`)
  .default([]);

export const ginhawaClinicianSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, "Name is required.").max(120),
  suffix: z.string().trim().max(40).default(""),
  role: z.string().trim().max(80).default(""),
  initials: z.string().trim().max(4).default(""),
  photo: optionalText,
  licence: z.string().trim().max(120).default(""),
  credentialsMd: z.string().trim().max(4000).default(""),
});

export const ginhawaLandingFormSchema = z.object({
  sourceEventId: z.string().uuid("Pick an event to publish."),
  template: z.enum(LANDING_TEMPLATES).default("medical"),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  dateLabel: z.string().trim().min(1, "Date is required.").max(80),
  timeLabel: z.string().trim().min(1, "Time is required.").max(40),
  heroWhat: z.string().trim().max(500).default(""),
  giftPoints: nonNegInt,
  giftPeso: nonNegInt,
  capacity: optionalCapacity,
  clinicians: z.array(ginhawaClinicianSchema).max(4, "At most 4 clinicians."),
  media: landingMediaListSchema,
  askTitle: z.string().trim().max(200).default(""),
  askBody: z.string().trim().max(2000).default(""),
  askHit: z.string().trim().max(200).default(""),
  gutTitle: z.string().trim().max(200).default(""),
  gutBody: z.string().trim().max(2000).default(""),
  gutClose: z.string().trim().max(400).default(""),
  venueName: optionalText,
  venueAddress: optionalText,
  mapUrl: optionalLenientUrl,
  bookUrl: optionalLenientUrl,
});

export type GinhawaLandingFormInput = z.input<typeof ginhawaLandingFormSchema>;
export type GinhawaLandingFormValues = z.output<typeof ginhawaLandingFormSchema>;
export type GinhawaClinicianInput = z.input<typeof ginhawaClinicianSchema>;
