type CookieOptions = { domain: string } | undefined;

/**
 * Keep the shared `.gutguard.ph` session on Gutguard hosts, but fall back to
 * Supabase's host-only cookie on Vercel aliases. Browsers silently reject a
 * Domain cookie when the response host is outside that domain.
 */
export function cookieOptionsForRequestHost(
  options: CookieOptions,
  requestHostname: string | null | undefined,
): CookieOptions {
  if (!options || !requestHostname) return options;

  const domain = options.domain
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  const forwardedHost = requestHostname.split(",")[0]?.trim().toLowerCase() ?? "";
  const hostname = forwardedHost.replace(/:\d+$/, "").replace(/\.+$/, "");

  return hostname === domain || hostname.endsWith(`.${domain}`)
    ? options
    : undefined;
}
