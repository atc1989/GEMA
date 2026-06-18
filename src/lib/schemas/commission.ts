import { z } from "zod";

export const convertProspectSchema = z.object({
  prospectId: z.string().uuid(),
  basisAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return 500;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: "Basis amount must be a non-negative number.",
    }),
});

export type ConvertProspectInput = z.input<typeof convertProspectSchema>;

export const commissionActionSchema = z.object({
  commissionId: z.string().uuid(),
});

export type CommissionActionInput = z.infer<typeof commissionActionSchema>;
