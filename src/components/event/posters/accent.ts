/** Poster accent. Colour-by-event-type is disabled — every banner uses the same
 *  brand-blue accent; only the type label varies. */

export type PosterAccent = {
  /** Vivid accent — bars, date numerals, dots. */
  accent: string;
  /** Dark shade — gradient end / dark backgrounds (white text sits on this). */
  deep: string;
  /** Light tint — editorial backgrounds, chips. */
  soft: string;
  /** Readable label for the type. */
  label: string;
};

const ACCENT = { accent: "#2f7fd6", deep: "#0a2440", soft: "#eaf2fc" };

const TYPE_LABELS: Record<string, string> = {
  presentation: "Presentation",
  business: "Presentation",
  training: "Training",
  sizzle: "Special Event",
  mentoring: "Special Event",
  fellowship: "Special Event",
  other: "Wellness Event",
};

export function accentForType(eventType?: string): PosterAccent {
  return { ...ACCENT, label: (eventType && TYPE_LABELS[eventType]) || "Wellness Event" };
}
