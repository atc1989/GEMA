import { z } from "zod";

export const onboardMemberSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username must be at most 20 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores."),
  sponsorRef: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type OnboardMemberInput = z.input<typeof onboardMemberSchema>;

export const createReferralSchema = z.object({
  eventId: z.string().uuid().optional(),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;
