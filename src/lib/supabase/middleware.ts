import { createServerClient } from "@supabase/ssr";

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
  const { data } = await supabase.auth.getClaims();
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
  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return redirectWithSession(url);
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
