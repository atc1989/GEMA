import { z } from "zod";

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "At least 8 characters.")
      .regex(/[A-Z]/, "Must include an uppercase letter.")
      .regex(/[0-9]/, "Must include a number."),
    confirmPassword: z.string(),
  })
  .superRefine(({ newPassword, confirmPassword }, ctx) => {
    if (newPassword !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
