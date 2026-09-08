/**
 * Which auth cookies to remove when the auth server says a session is gone.
 *
 * Pure and free of `next/server` on purpose — this decides what gets deleted
 * from 431 browsers, so it is worth testing directly rather than by reading the
 * middleware's source.
 */

/**
 * `gema.gutguard.ph` -> `.gutguard.ph`. Null when there is no parent to speak
 * of — a bare host, `localhost`, or an IP.
 */
export function parentCookieDomain(hostname: string): string | null {
  if (/^[0-9.]+$/.test(hostname)) return null;
  const labels = hostname.split(".");
  if (labels.length < 3) return null;
  return `.${labels.slice(1).join(".")}`;
}

/**
 * Every auth cookie of THIS Supabase project that the browser sent, plus
 * whatever the library asked to clear.
 *
 * Not simply the library's list. The browser can hold an unchunked
 * `sb-<ref>-auth-token` beside chunked `.0` / `.1` parts of a different
 * session — the state that was in production on 2026-09-08 — and the clear
 * batch only names the shape the library believes in. Whatever it did not
 * reassemble is what stays behind and shadows the next sign-in.
 *
 * Scoped to this project's ref, never a bare `sb-` prefix. The spokes keep
 * their own session under `sb-fxdsnacuonfvutdquogb-…` on the same parent
 * domain, and signing out of GEMA must not sign anyone out of Lifestyle.
 */
export function deadSessionCookieNames(
  cookieNames: string[],
  supabaseUrl: string,
  fromLibrary: string[] = [],
): string[] {
  const names = new Set(fromLibrary);

  let ref: string | null = null;
  try {
    ref = new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    ref = null;
  }

  if (ref) {
    const prefix = `sb-${ref}-`;
    for (const name of cookieNames) {
      if (name.startsWith(prefix)) names.add(name);
    }
  }

  return [...names];
}
