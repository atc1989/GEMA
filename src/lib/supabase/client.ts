import { createBrowserClient } from "@supabase/ssr";

import { sharedSessionCookieOptions } from "@/lib/one-account/client";

/**
 * Supabase client for use in Client Components. Shares the auth session with
 * the server via cookies managed by `@supabase/ssr`.
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "gema" },
    // Change 6: the browser writes these cookies too, so it must agree with the
    // server about their Domain — otherwise two cookies share one name.
    cookieOptions: sharedSessionCookieOptions(),
  });
}
