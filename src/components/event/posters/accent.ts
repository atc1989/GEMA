/** Accent palette for posters, derived from the event type so banners echo the
 *  calendar's colour language (presentation=blue, training=green, special=gold).
 *  Plain hex values — posters render to a canvas and are exported via
 *  html-to-image, so they must not depend on CSS variables. */

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

const BLUE: PosterAccent = { accent: "#2f7fd6", deep: "#0a2440", soft: "#eaf2fc", label: "Presentation" };
const GREEN: PosterAccent = { accent: "#1e9e57", deep: "#0c3d24", soft: "#e8f7ef", label: "Training" };
const GOLD: PosterAccent = { accent: "#c9890a", deep: "#3f2c06", soft: "#fbf2dd", label: "Special Event" };
const BRAND: PosterAccent = { accent: "#1f5d99", deep: "#0a2440", soft: "#eef3fb", label: "Wellness Event" };

const BY_TYPE: Record<string, PosterAccent> = {
  presentation: BLUE,
  business: BLUE,
  training: GREEN,
  sizzle: GOLD,
  mentoring: GOLD,
  fellowship: GOLD,
  other: BRAND,
};

export function accentForType(eventType?: string): PosterAccent {
  return (eventType && BY_TYPE[eventType]) || BRAND;
}
