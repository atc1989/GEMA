import { z } from "zod";

import { LANDING_COPY, landingCopyFor } from "@/lib/ginhawa/prefill";
import { LANDING_TEMPLATES, asLandingTemplate } from "@/lib/ginhawa/templates";
import { landingMediaListSchema } from "@/lib/schemas/ginhawa-landing";

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

export const eventVisibilitySchema = z.enum(["public", "private", "company_support"]);

export const eventModeSchema = z.enum(["in_person", "online", "hybrid"]);

export type EventType = z.infer<typeof eventTypeSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventVisibility = z.infer<typeof eventVisibilitySchema>;
export type EventMode = z.infer<typeof eventModeSchema>;

// Optional text field that normalizes "" -> undefined so empty inputs become NULL.
/**
 * A wall-clock "HH:MM" from <input type="time">. Untouched inputs arrive as "",
 * and a value read back from Postgres `time` arrives as "12:00:00", so both are
 * normalised here rather than at every call site.
 */
const clockTime = z
  .string()
  .trim()
  .nullish()
  .transform((v) => {
    if (!v) return undefined;
    const match = /^(\d{1,2}):(\d{2})/.exec(v);
    if (!match) return v;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  })
  .refine((v) => v === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), {
    message: "Enter a time like 12:00.",
  });

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

const draftClinicianSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().max(120).default(""),
  suffix: z.string().trim().max(40).default(""),
  role: z.string().trim().max(80).default(""),
  initials: z.string().trim().max(4).default(""),
  photo: optionalText,
  licence: z.string().trim().max(120).default(""),
  credentialsMd: z.string().trim().max(4000).default(""),
});

/**
 * Medical landing fields embedded in event create/edit.
 * When enabled=false, the nested content is ignored on save.
 */
export const eventLandingFieldsSchema = z.object({
  enabled: z.boolean().default(false),
  template: z.enum(LANDING_TEMPLATES).default("session"),
  heroWhat: z.string().trim().max(500).default(""),
  giftPoints: nonNegInt.default(750),
  giftPeso: nonNegInt.default(750),
  // Allow blank name rows in the form; sync filters them out before upsert.
  clinicians: z.array(draftClinicianSchema).max(4, "At most 4 clinicians.").default([]),
  media: landingMediaListSchema,
  // Fallbacks for a payload missing these keys; they track the schema's own
  // default template (session), not the medical copy.
  askTitle: z.string().trim().max(200).default(LANDING_COPY.session.askTitle),
  askBody: z.string().trim().max(2000).default(LANDING_COPY.session.askBody),
  askHit: z.string().trim().max(200).default(LANDING_COPY.session.askHit),
  gutTitle: z.string().trim().max(200).default(LANDING_COPY.session.gutTitle),
  gutBody: z.string().trim().max(2000).default(LANDING_COPY.session.gutBody),
  gutClose: z.string().trim().max(400).default(LANDING_COPY.session.gutClose),
});

export type EventLandingFieldsInput = z.input<typeof eventLandingFieldsSchema>;
export type EventLandingFieldsValues = z.output<typeof eventLandingFieldsSchema>;

export function defaultEventLandingFields(
  overrides?: Partial<EventLandingFieldsInput>,
): EventLandingFieldsInput {
  // Copy follows the template, so a new Session landing does not open with
  // the medical Ask block.
  const template = asLandingTemplate(overrides?.template ?? "session");
  const copy = landingCopyFor(template);
  return {
    enabled: false,
    template,
    heroWhat: "",
    giftPoints: 750,
    giftPeso: 750,
    clinicians: [],
    media: [],
    askTitle: copy.askTitle,
    askBody: copy.askBody,
    askHit: copy.askHit,
    gutTitle: copy.gutTitle,
    gutBody: copy.gutBody,
    gutClose: copy.gutClose,
    ...overrides,
  };
}

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
    /**
     * Arrival windows, one team at a time. On means no walk-ins:
     * the grid becomes the event's capacity, so the Capacity field is derived
     * and stops being the host's to set.
     */
    schedulingEnabled: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
    /**
     * Mid-day break, wall-clock in the event's timezone ("12:00"). Both blank
     * runs the day straight through; a <input type="time"> that was never
     * touched arrives as "", which is why this is not a bare optional.
     */
    /**
     * Minutes per arrival window. Kept to the values the form offers so it can
     * never violate the database's "5-120, in steps of 5" check.
     */
    slotMinutes: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      })
      .refine(
        (v) => v === undefined || (Number.isInteger(v) && v >= 5 && v <= 120 && v % 5 === 0),
        { message: "Pick a window length between 5 and 120 minutes." },
      ),
    /**
     * Doctor+nurse teams working one window, one guest each. The only lever
     * that raises the seat count without shortening the window.
     */
    teamsPerSlot: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      })
      .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 20), {
        message: "Between 1 and 20 teams.",
      }),
    /**
     * When every window has gone, take names for a queue instead of turning
     * people away. Capped, because an uncapped list is how two hundred people
     * turn up to a hall with twenty-eight chairs.
     */
    standbyEnabled: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
    standbyLimit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      })
      .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 500), {
        message: "A standby list holds between 1 and 500 people.",
      }),
    breakStart: clockTime,
    breakEnd: clockTime,
    /**
     * The working day, wall-clock in the event's timezone. A repeating clinic
     * is ONE event: starts_at..ends_at is the run, these are the hours worked
     * on each day of it. Blank both falls back to the event's own times.
     */
    dayStart: clockTime,
    dayEnd: clockTime,
    /**
     * Days of the week that run, 0 = Sunday. Empty means every date in the run.
     * Checkboxes post strings, and a single checked box posts a bare string
     * rather than an array.
     */
    weekdays: z
      .union([z.array(z.union([z.string(), z.number()])), z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return [] as number[];
        const list = Array.isArray(v) ? v : [v];
        return list
          .map((item) => (typeof item === "number" ? item : Number(item)))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
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
    landing: eventLandingFieldsSchema.optional(),
  })
  .refine(
    (data) => data.endsAt === undefined || Date.parse(data.endsAt) > Date.parse(data.startsAt),
    { message: "End time must be after the start time.", path: ["endsAt"] },
  )
  .refine((data) => !data.schedulingEnabled || data.endsAt !== undefined, {
    message: "Arrival times need an end time — that is what the windows step to.",
    path: ["endsAt"],
  })
  .refine((data) => (data.breakStart === undefined) === (data.breakEnd === undefined), {
    message: "A break needs both a start and an end. Clear both for no break.",
    path: ["breakEnd"],
  })
  .refine((data) => (data.dayStart === undefined) === (data.dayEnd === undefined), {
    message: "A working day needs both a start and an end. Clear both to use the event times.",
    path: ["dayEnd"],
  })
  .refine(
    (data) =>
      data.dayStart === undefined || data.dayEnd === undefined || data.dayEnd > data.dayStart,
    { message: "The working day must end after it starts.", path: ["dayEnd"] },
  )
  .refine(
    (data) =>
      data.breakStart === undefined ||
      data.breakEnd === undefined ||
      data.breakEnd > data.breakStart,
    { message: "The break must end after it starts.", path: ["breakEnd"] },
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
 * Members with self-publish permission skip admin review entirely (the RPC
 * publishes on create), so unlike the admin flow there's no later "Publish"
 * step to catch a missing description — require it upfront instead.
 */
export const memberEventFormSchema = eventFormSchema.refine(
  (data) => Boolean(data.description?.trim()),
  { message: "Add a description before submitting.", path: ["description"] },
);

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
    startsAt: z.string().refine((v) => Number.isFinite(Date.parse(v)), {
      message: "A valid start time is required to publish.",
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
