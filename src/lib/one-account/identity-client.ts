import "server-only";

import { createClient } from "@supabase/supabase-js";

import { identitySchema } from "./support.ts";

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

  announceTarget(url);

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: identitySchema() },
  });
}

let announced = "";

/**
 * Says once per process which Supabase project and schema the identity spine
 * is pointed at. A deployment silently built against the wrong project looks
 * exactly like a member who does not exist, and that cost a debugging round.
 * The URL is public (`NEXT_PUBLIC_`); the key is never logged.
 */
function announceTarget(url: string) {
  const schema = identitySchema();
  const target = `${url}|${schema}`;
  if (announced === target) return;
  announced = target;
  console.info("[one-account] identity spine", { url, schema });
}

export type IdentityAdminClient = ReturnType<typeof createIdentityAdminClient>;
