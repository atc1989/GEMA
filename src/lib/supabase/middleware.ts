import { createServerClient } from "@supabase/ssr";

import {
  authCookieReport,
  isTransientAuthFailure,
  logAuthRedirect,
} from "@/lib/auth/auth-diagnostics";
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

  /**
   * A session clear held back until the error that caused it is classified.
   *
   * @supabase/ssr clears the stored session on any refresh failure, and that
   * arrives as a batch of empty values before `getClaims()` has returned — so
   * setAll cannot yet tell a blip from a session that is genuinely gone. It
   * parks the batch here and the decision is made below, once the error is in
   * hand.
   */
  const pendingSessionClear: string[] = [];

  /**
   * Prefetches do not get a session refresh.
   *
   * Next prefetches every <Link> in the viewport. Opening the admin sidebar
   * fires ten requests inside two seconds, each running this middleware with
   * its own Supabase client, each refreshing the SAME refresh token. Supabase
   * rotates the token on refresh: the first request consumes it and the other
   * nine present one that no longer exists, which is exactly the
   * "Refresh Token Not Found" storm in the production log.
   *
   * A prefetch is speculative — nobody has navigated — so there is no session
   * to keep fresh. The real navigation that follows refreshes normally. The
   * gates below are skipped too, which is correct: a prefetch renders nothing
   * the member sees, and the page guards (requireAdmin/requireMember) are the
   * authoritative check either way.
   */
  if (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return supabaseResponse;
  }

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
        /**
         * This middleware refreshes sessions. It must never END one.
         *
         * When a refresh fails — "Invalid Refresh Token: Refresh Token Not
         * Found" — @supabase/ssr clears the stored session, and that arrives
         * here as a batch where every value is empty. Writing those deletions
         * onto the response tells the browser to drop cookies it is still
         * holding: the failed refresh becomes the sign-out.
         *
         * That is how a member loses a session six seconds after signing in.
         * The POST to /login runs this middleware first, with the stale cookie
         * the browser arrived with; the refresh of that stale token fails, and
         * the deletions race the fresh cookies the sign-in is setting.
         *
         * Signing out does not come through here — signOutAction() uses the
         * server client — so in middleware an all-empty batch is never a real
         * sign-out, and dropping it costs nothing.
         *
         * A successful write is not affected. Removing a surplus cookie chunk
         * ships alongside the new value in the same batch, so the batch is not
         * all-empty and still applies in full.
         */
        if (cookiesToSet.every(({ value }) => value === "")) {
          pendingSessionClear.push(...cookiesToSet.map(({ name }) => name));
          return;
        }

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

  const transient = isTransientAuthFailure(claimsError);

  /**
   * A session the auth server has declared gone must have its cookie removed.
   *
   * Holding on to it was the mistake left by the previous change. The dead
   * cookie stays in the browser, the next sign-in adds a second cookie of the
   * SAME name beside it, and the browser then sends both. Next's cookie map is
   * keyed by name and keeps one — so the middleware can read the dead one and
   * bounce the member to /login while the page, a request later, reads the live
   * one and lets them in. One bounce, then everything works: exactly what was
   * reported.
   *
   * Only on a definitive failure. A blip still keeps the session, which is the
   * whole point of the guard above.
   */
  if (!transient && pendingSessionClear.length > 0) {
    const sharedDomain = sharedSessionCookieOptions()?.domain;
    for (const name of pendingSessionClear) {
      // Both scopes. A delete carrying `Domain=.gutguard.ph` does not touch a
      // cookie of the same name set host-only on `gema.gutguard.ph`, and that
      // leftover is the duplicate doing the damage — so remove each name at the
      // host and, when the shared domain is configured, at the parent too.
      supabaseResponse.cookies.set(name, "", { path: "/", maxAge: 0 });
      if (sharedDomain) {
        supabaseResponse.cookies.set(name, "", { path: "/", maxAge: 0, domain: sharedDomain });
      }
    }
  }

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
      !claimsError
        ? "middleware: no session on a protected path"
        : transient
          ? "middleware: getClaims failed — passing through to the page guard"
          : "middleware: auth server says this session is gone — sign in again",
      {
        path: request.nextUrl.pathname,
        claimsError: claimsError?.message ?? null,
        transient,
        ...authCookieReport(request.headers.get("cookie")),
      },
    );

    // Pass through only while the failure could still be transient. An auth
    // server that has answered "this session is gone" is not something the page
    // guard can improve on.
    if (!transient) {
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
