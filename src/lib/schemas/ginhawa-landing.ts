import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

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

const optionalCapacity = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
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
  template: z.enum(["medical", "sizzle", "session"]).default("medical"),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  dateLabel: z.string().trim().min(1, "Date is required.").max(80),
  timeLabel: z.string().trim().min(1, "Time is required.").max(40),
  heroWhat: z.string().trim().max(500).default(""),
  giftPoints: nonNegInt,
  giftPeso: nonNegInt,
  capacity: optionalCapacity,
  clinicians: z.array(ginhawaClinicianSchema).max(4, "At most 4 clinicians."),
  videoUrl: optionalLenientUrl,
  videoLength: z.string().trim().max(20).default(""),
  videoCaption: z.string().trim().max(240).default(""),
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
