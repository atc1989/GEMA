import { z } from "zod";

export const gutGuardDoseSlotSchema = z.enum(["morning", "midday", "dreams"]);
export const gutGuardDoseStatusSchema = z.enum(["scheduled", "taken", "skipped", "missed"]);
export const gutGuardReminderChannelSchema = z.enum([
  "in_app",
  "push",
  "sms",
  "messenger",
  "viber",
  "call",
]);
