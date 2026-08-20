import type { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase client bound to schema `gema`.
 * The default `SupabaseClient` generic is `public`, which no longer matches.
 */
export type GemaClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
