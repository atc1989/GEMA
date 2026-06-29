import { z } from "zod";

export const eventTypeSchema = z.enum([
  "presentation",
  "business",
  "training",
  "sizzle",
  "mentoring",
  "fellowship",
  "other",
]);

export const eventStatusSchema = z.enum([
  "draft",
  "published",
  "cancelled",
  "completed",
  "archived",
]);

export const eventVisibilitySchema = z.enum(["public", "private"]);

export const eventModeSchema = z.enum(["in_person", "online", "hybrid"]);

export type EventType = z.infer<typeof eventTypeSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventVisibility = z.infer<typeof eventVisibilitySchema>;
export type EventMode = z.infer<typeof eventModeSchema>;

// Optional text field that normalizes "" -> undefined so empty inputs become NULL.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.string().url().safeParse(v).success, {
    message: "Enter a valid URL.",
  });

// Like optionalUrl but forgiving: blank is allowed and a scheme-less value
// (e.g. "maps.app.goo.gl/x") is normalized to https:// before validation.
const optionalLenientUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .refine((v) => v === undefined || z.string().url().safeParse(v).success, {
    message: "Enter a valid URL, or leave blank.",
  });

// datetime-local produces "YYYY-MM-DDTHH:mm" (no timezone); accept that too.
const dateTimeString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date and time." });

/**
 * Shared create/edit form schema. camelCase to match the app's TS types; the
 * action maps these to snake_case DB columns.
 */
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
    eventType: eventTypeSchema,
    visibility: eventVisibilitySchema.default("public"),
    mode: eventModeSchema.default("in_person"),
    startsAt: dateTimeString,
    endsAt: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
        message: "Enter a valid date and time.",
      }),
    timezone: z.string().trim().min(1).default("Asia/Manila"),
    venueName: optionalText,
    venueAddress: optionalText,
    mapUrl: optionalLenientUrl,
    onlineUrl: optionalUrl,
    capacity: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      })
      .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
        message: "Capacity must be a positive whole number.",
      }),
    description: optionalText,
    bannerUrl: optionalLenientUrl,
    speakerName: optionalText,
    // Banner design id; sanitized to a known template by the action.
    posterTemplate: optionalText,
    // Public URL of an uploaded speaker photo (Supabase Storage).
    speakerPhotoUrl: optionalText,
    // Host-chosen photo framing (pan/zoom); clamped by the action.
    photoFocus: z
      .object({ x: z.number(), y: z.number(), zoom: z.number() })
      .optional(),
  })
  .refine(
    (data) => data.endsAt === undefined || Date.parse(data.endsAt) > Date.parse(data.startsAt),
    { message: "End time must be after the start time.", path: ["endsAt"] },
  )
  .refine((data) => data.mode === "online" || Boolean(data.venueName), {
    message: "Venue name is required for in-person and hybrid events.",
    path: ["venueName"],
  })
  .refine((data) => data.mode === "in_person" || Boolean(data.onlineUrl), {
    message: "Online URL is required for online and hybrid events.",
    path: ["onlineUrl"],
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/**
 * Stricter gate applied at publish time. Validates the already-stored event
 * has the minimum fields the public-facing page needs.
 */
export const publishReadinessSchema = z
  .object({
    title: z.string().trim().min(3),
    eventType: eventTypeSchema,
    visibility: eventVisibilitySchema,
    mode: eventModeSchema,
    startsAt: z.string().refine((v) => Date.parse(v) > Date.now(), {
      message: "Start time must be in the future to publish.",
    }),
    venueName: z.string().nullable().optional(),
    onlineUrl: z.string().nullable().optional(),
    description: z
      .string()
      .nullable()
      .optional()
      .refine((v) => Boolean(v?.trim()), {
        message: "Add a description before publishing.",
      }),
  })
  .refine((data) => data.mode === "online" || Boolean(data.venueName), {
    message: "A venue is required before publishing an in-person/hybrid event.",
    path: ["venueName"],
  })
  .refine((data) => data.mode === "in_person" || Boolean(data.onlineUrl), {
    message: "An online URL is required before publishing an online/hybrid event.",
    path: ["onlineUrl"],
  });

export const cancelEventSchema = z.object({
  reason: z.string().trim().min(3, "Provide a short reason (min 3 characters).").max(500),
});

export type CancelEventInput = z.infer<typeof cancelEventSchema>;
