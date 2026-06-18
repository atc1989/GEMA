import { createBrowserClient } from "@supabase/ssr";

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

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
