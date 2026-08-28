import "server-only";

import { createClient } from "@supabase/supabase-js";

import { identitySchema } from "./support";

/**
 * Service-role client for the shared identity spine — BYPASSES RLS. Server
 * only, never import into a client component. Every app that hosts login
 * builds the same client here so the engine behaves identically on each
 * origin, instead of inheriting each app's own schema pinning.
 */
export function createIdentityAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) for shared login.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: identitySchema() },
  });
}

export type IdentityAdminClient = ReturnType<typeof createIdentityAdminClient>;
