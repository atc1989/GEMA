import { z } from "zod";

export const prospectRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid mobile number.")
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, "Mobile number contains invalid characters.")
    // ponytail: PH-only normalization to +639…; other countries pass through as typed.
    .transform((v) => {
      const digits = v.replace(/[^\d+]/g, "");
      if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
      if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
      if (/^639\d{9}$/.test(digits)) return `+${digits}`;
      return digits;
    }),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  city: z.string().trim().min(2, "Enter your city.").max(120),
  consentPrivacy: z
    .boolean()
    .refine((v) => v === true, "You must agree to the privacy terms to register."),
  consentMarketing: z.boolean().optional().default(false),
  refCode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type ProspectRegistrationInput = z.input<typeof prospectRegistrationSchema>;
export type ProspectRegistrationValues = z.output<typeof prospectRegistrationSchema>;
