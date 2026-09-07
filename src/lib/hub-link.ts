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

/**
 * Change 4c (D13) — account creation lives on Lifestyle only. GEMA never grows
 * a sign-up form; it links to the hub's register and asks to be sent back.
 *
 * `returnTo` is the path on **this** app to land on afterwards, built from
 * `NEXT_PUBLIC_SITE_URL`. The hub checks it against its own origin allow-list
 * and silently ignores anything it does not recognise, so a wrong or missing
 * value costs the member a redirect, never a wrong destination.
 *
 * `null` when either origin is unconfigured — the caller renders no link at
 * all, rather than a register button that goes nowhere.
 */
export function hubRegisterUrl(
  returnToPath = "/discover",
  hub: string | null = hubOrigin(),
  self: string | undefined | null = process.env.NEXT_PUBLIC_SITE_URL,
): string | null {
  if (!hub) return null;

  const selfOrigin = hubOrigin(self);
  const register = `${hub}/register`;
  if (!selfOrigin) return register;

  const path = returnToPath.startsWith("/") ? returnToPath : `/${returnToPath}`;
  return `${register}?returnTo=${encodeURIComponent(`${selfOrigin}${path}`)}`;
}
