/**
 * Change 5 — the link home to the hub.
 *
 * Lifestyle is Gutguard home; GEMA is a spoke. One link, not a nav.
 *
 * `null` when unconfigured, and the caller renders nothing — a home link that
 * goes nowhere is worse than no home link, and unconfigured is the state before
 * the owner's DNS lands.
 *
 * Read as a literal `process.env.NEXT_PUBLIC_*` because Next inlines it only in
 * that form; a lookup by key reads `undefined` in the browser.
 */
export function hubOrigin(
  raw: string | undefined | null = process.env.NEXT_PUBLIC_LIFESTYLE_URL,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
