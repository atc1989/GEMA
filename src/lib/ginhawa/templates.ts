/** Landing page template ids shared by forms, sync, and public render. */

export const LANDING_TEMPLATES = ["medical", "checkup", "sizzle", "session"] as const;

export type LandingTemplate = (typeof LANDING_TEMPLATES)[number];

export const LANDING_TEMPLATE_META: Record<
  LandingTemplate,
  { label: string; hint: string }
> = {
  medical: {
    label: "Medical (Ginhawa)",
    hint: "Free check-up layout with clinicians, Ask, and Why the gut.",
  },
  checkup: {
    label: "Check-up (narrow)",
    hint: "Same check-up content as Medical, but single-column and phone-first.",
  },
  sizzle: {
    label: "Sizzle",
    hint: "High-energy invite for Saturday Sizzle and similar nights.",
  },
  session: {
    label: "Session",
    hint: "Clean layout for presentations, training, and business events.",
  },
};

/** Suggested template from the event type when the host turns landing on. */
export function defaultLandingTemplateForEventType(
  eventType: string | null | undefined,
): LandingTemplate {
  if (eventType === "sizzle") return "sizzle";
  if (eventType === "training" || eventType === "mentoring") return "session";
  // Presentations / business / fellowship / other → session.
  // Medical check-ups are usually company_support + host picks Medical.
  return "session";
}

export function isLandingTemplate(value: unknown): value is LandingTemplate {
  return typeof value === "string" && (LANDING_TEMPLATES as readonly string[]).includes(value);
}

export function asLandingTemplate(value: unknown): LandingTemplate {
  return isLandingTemplate(value) ? value : "medical";
}
