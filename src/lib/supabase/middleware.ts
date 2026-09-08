import { createServerClient } from "@supabase/ssr";

import { authCookieReport, logAuthRedirect } from "@/lib/auth/auth-diagnostics";
import { sharedSessionCookieOptions } from "@/lib/one-account";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every matched request and keeps the
 * session cookies in sync between the browser and server. Returns the response
 * that MUST be returned from `middleware.ts` so refreshed cookies are sent.
 *
 * Do not run code between creating the client and calling `getUser()` — see
 * the @supabase/ssr Next.js guide.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "gema" },
    // Change 6: one session across the three origins. Undefined until
    // NEXT_PUBLIC_ONE_ACCOUNT_COOKIE_DOMAIN is set, so this is a no-op today.
    cookieOptions: sharedSessionCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() verifies the JWT locally when the project uses asymmetric
  // signing keys (no auth-server round trip); with a legacy symmetric secret it
  // falls back to a server check, matching getUser(). Refreshes expired sessions.
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: data.claims.sub } : null;

  /**
   * Redirect, carrying whatever cookies the refresh above just wrote.
   *
   * `setAll` puts the refreshed session on `supabaseResponse`. A bare
   * `NextResponse.redirect()` is a *different* response, so those cookies never
   * reach the browser — while Supabase has already rotated the refresh token
   * server-side and invalidated the one the browser still holds. The member is
   * signed out on their next request.
   *
   * That is how this surfaced: the redirects below are the ones that fire when
   * a signed-in person opens an invite or register link for an event, so people
   * were being signed out on the way into an event and could not then be
   * checked in. `GutGuard-Life-Style/lib/supabase/middleware.ts` already does
   * this; GEMA was the copy that did not.
   *
   * Every redirect out of this function must go through here.
   */
  const redirectWithSession = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  };

  // Gate the admin workspace: unauthenticated users are sent to login.
  //
  // "No claims" has two very different causes and this gate used to treat them
  // the same. Genuinely signed out is one. The other is getClaims() *failing* —
  // it calls getSession(), and with asymmetric signing keys it also fetches the
  // JWKS over the network on the way through. A refresh that could not be
  // persisted, a slow or failed fetch from the edge, an auth-server blip: all
  // land here with an error and an empty user, and all used to read as "signed
  // out" and bounce a member who was holding a perfectly good session.
  //
  // Failing open on an *error* is safe, because this gate is not the one that
  // decides anything. `(admin)/layout.tsx` calls requireAdmin() on every page
  // under /admin, and RLS gates the data underneath — require-admin.ts calls
  // this middleware check defence in depth itself. If the failure is real, the
  // layout redirects a moment later on its own. If it was transient, the member
  // keeps the session they should never have lost.
  //
  // A genuine no-session, with no error, still redirects exactly as before.
  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    // This is the redirect behind "if you click on events it goes back to
    // /login?redirectTo=%2Fadmin%2Fevents". Until now it did not say why.
    logAuthRedirect(
      claimsError
        ? "middleware: getClaims failed — passing through to the page guard"
        : "middleware: no session on a protected path",
      {
        path: request.nextUrl.pathname,
        claimsError: claimsError?.message ?? null,
        ...authCookieReport(request.headers.get("cookie")),
      },
    );

    if (!claimsError) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return redirectWithSession(url);
    }
  }

  // Redirect authenticated members/admins away from public invite/register pages.
  if (user) {
    const pathname = request.nextUrl.pathname;
    const inviteMatch = pathname.match(/^\/(invite|register)\/([^/]+)$/);
    if (inviteMatch) {
      const eventId = inviteMatch[2];

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.is_admin || profile.role === "admin") {
          const url = request.nextUrl.clone();
          url.pathname = `/admin/events/${eventId}`;
          return redirectWithSession(url);
        }

        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (member) {
          const url = request.nextUrl.clone();
          url.pathname = `/member/events/${eventId}`;
          return redirectWithSession(url);
        } else {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding";
          return redirectWithSession(url);
        }
      }
    }
  }

  return supabaseResponse;
}
