/**
 * Change 6 — one browser session across Lifestyle, GEMA and Academy.
 *
 * The three apps are three origins under one parent: `app.gutguard.ph`,
 * `gema.gutguard.ph`, `academy.gutguard.ph`. `@supabase/ssr` sets host-only
 * cookies by default, so each origin keeps its own session and a member signs
 * in three times. Giving the auth cookie `Domain=.gutguard.ph` makes one
 * sign-in serve all three, and a sign-out on the hub end the session
 * everywhere.
 *
 * Off unless configured. With the env var unset every helper here returns
 * `undefined`, which is exactly the option object each app passes today.
 *
 * ## Why the variable is NEXT_PUBLIC_
 *
 * The browser client writes these cookies too. If the server wrote them at
 * `.gutguard.ph` while the browser wrote host-only ones, there would be two
 * cookies of the same name at two scopes and no rule about which wins. A
 * cookie's Domain is visible in devtools anyway — there is nothing to keep
 * secret, and a server-only variable would silently break the browser half.
 *
 * ## Why the value is read as a default parameter, not looked up
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only where it is
 * written as a literal member expression. An `env[key]` lookup is not
 * rewritten, so in the browser it reads `undefined` and the feature quietly
 * half-works. Hence the literal below, and callers in tests pass the raw
 * string instead of an env object.
 *
 * ## Why a public suffix cannot be used
 *
 * A cookie Domain must be a registrable domain. `.vercel.app` and `.com.ph`
 * are on the Public Suffix List and browsers reject them **silently** — which
 * looks exactly like the feature not working. `guardCookieDomain` refuses the
 * shapes this project can actually produce rather than leaving that to a
 * console nobody is reading.
 *
 * ## Changing this on Production
 *
 * Existing sessions hold host-only cookies. The browser keeps sending them, so
 * members are not signed out, and `@supabase/ssr` clears the host-only
 * counterpart on sign-out once `cookieOptions.domain` is set. It is still a
 * scope change on live sessions: Staging first, and Production only with the
 * owner, per `00 - Locks` and the Change 6 note.
 */

/** The one variable that turns parent-domain cookies on. */
export const COOKIE_DOMAIN_ENV_KEY = "NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN";

/**
 * Suffixes that are never a registrable domain. Not the whole Public Suffix
 * List — just the shapes this project can actually produce: a Vercel host, and
 * the Philippine second-level domains that sit beside `gutguard.ph`.
 */
const NEVER_REGISTRABLE = new Set([
  "vercel.app",
  "vercel.sh",
  "now.sh",
  "github.io",
  "com.ph",
  "net.ph",
  "org.ph",
  "gov.ph",
  "edu.ph",
]);

export type CookieDomainProblem =
  | "empty"
  | "not-a-hostname"
  | "single-label"
  | "public-suffix";

export type CookieDomainResult =
  | { ok: true; domain: string }
  | { ok: false; problem: CookieDomainProblem };

/**
 * Normalize a configured value to a cookie `Domain`, or say why it cannot be
 * one. Accepts `gutguard.ph`, `.gutguard.ph`, or a full URL, and always returns
 * the leading-dot form — the shape that matches subdomains.
 */
export function guardCookieDomain(raw: string | null | undefined): CookieDomainResult {
  if (typeof raw !== "string") return { ok: false, problem: "empty" };

  let value = raw.trim().toLowerCase();
  if (!value) return { ok: false, problem: "empty" };

  // A whole URL is a forgivable thing to paste into a variable named "domain".
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      return { ok: false, problem: "not-a-hostname" };
    }
  }

  value = value.replace(/^\.+/, "").replace(/\.+$/, "");
  if (!value) return { ok: false, problem: "empty" };

  // A hostname and nothing else: no port, path, credentials or wildcard.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(value)) {
    return { ok: false, problem: "not-a-hostname" };
  }

  const labels = value.split(".");
  // `localhost` and a bare TLD cannot carry a shared cookie.
  if (labels.length < 2) return { ok: false, problem: "single-label" };
  if (NEVER_REGISTRABLE.has(value)) return { ok: false, problem: "public-suffix" };

  return { ok: true, domain: `.${value}` };
}

/** Human-readable reason, for the one log line an app writes on a bad value. */
export function cookieDomainProblemMessage(problem: CookieDomainProblem, raw: string) {
  const shown = JSON.stringify(raw);
  switch (problem) {
    case "empty":
      return `${COOKIE_DOMAIN_ENV_KEY} is empty.`;
    case "not-a-hostname":
      return `${COOKIE_DOMAIN_ENV_KEY}=${shown} is not a bare hostname. Use gutguard.ph — no scheme, port or path.`;
    case "single-label":
      return `${COOKIE_DOMAIN_ENV_KEY}=${shown} has one label. A shared cookie needs a registrable domain such as gutguard.ph.`;
    case "public-suffix":
      return `${COOKIE_DOMAIN_ENV_KEY}=${shown} is a public suffix — browsers reject a cookie set on it, silently. Use the domain you registered.`;
  }
}

/**
 * The configured cookie domain, or `null` when the feature is off or the value
 * is unusable. A bad value is announced once per process, not per request: it
 * is a deployment mistake, and a silent one costs a debugging round.
 *
 * The default argument is a literal `process.env.NEXT_PUBLIC_…` so Next inlines
 * it for the browser bundle. Do not turn it into a lookup.
 */
export function configuredCookieDomain(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN,
): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  const result = guardCookieDomain(raw);
  if (result.ok) return result.domain;

  announceOnce(cookieDomainProblemMessage(result.problem, raw.trim()));
  return null;
}

const announced = new Set<string>();

function announceOnce(message: string) {
  if (announced.has(message)) return;
  announced.add(message);
  console.warn("[one-account] cookie domain ignored", { message });
}

/**
 * The `cookieOptions` to hand `createServerClient` / `createBrowserClient`, or
 * `undefined` when the feature is off — so a call site reads the same either
 * way and the default behaviour is untouched.
 *
 * `cookieOptions` rather than patching each app's `setAll`: it is the
 * library's own seam, it covers removals as well as writes, and it is what
 * makes `signOut` clear the host-only cookie left over from before the change.
 */
export function sharedSessionCookieOptions(
  raw?: string | null,
): { domain: string } | undefined {
  const domain = raw === undefined ? configuredCookieDomain() : configuredCookieDomain(raw);
  return domain ? { domain } : undefined;
}
