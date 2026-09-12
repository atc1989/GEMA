import { createServerClient } from "@supabase/ssr";

import { sharedSessionCookieOptions } from "@/lib/one-account";
import { cookieOptionsForRequestHost } from "@/lib/supabase/cookie-options";
import { cookies, headers } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth session from Next.js cookies so RLS runs as
 * the logged-in user (`auth.uid()`).
 *
 * In a Server Component the cookie store is read-only; the `setAll` writes are
 * wrapped in try/catch because session refresh there is handled by middleware.
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestHostname =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "gema" },
    // Share on gutguard.ph, but keep a host-only session on Vercel aliases.
    // A browser silently rejects Domain=.gutguard.ph from a *.vercel.app host.
    cookieOptions: cookieOptionsForRequestHost(
      sharedSessionCookieOptions(),
      requestHostname,
    ),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}
