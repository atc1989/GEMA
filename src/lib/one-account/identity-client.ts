import "server-only";

import { createClient } from "@supabase/supabase-js";

import { identitySchema } from "./support.ts";

/**
 * Service-role client for the shared identity spine — BYPASSES RLS. Server
 * only, never import into a client component. Every app that hosts login
 * builds the same client here so the engine behaves identically on each
 * origin, instead of inheriting each app's own schema pinning.
 *
 * `schema` defaults to the identity spine (`gema`). Change 3 made
 * `public.profiles` the other half of that spine, so a caller that needs the
 * person row the spokes read asks for `public` explicitly.
 */
export function createIdentityAdminClient(schema: string = identitySchema()) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) for shared login.",
    );
  }

  announceTarget(url, schema);

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}

/**
 * Whether a service-role client can be built at all. Lazy product rows are
 * written with it, and an app deployed without the key must fall back to the
 * member's own session rather than throw on a page render.
 */
export function hasIdentityAdminCredentials() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const announced = new Set<string>();

/**
 * Says once per process and schema which Supabase project the identity spine
 * is pointed at. A deployment silently built against the wrong project looks
 * exactly like a member who does not exist, and that cost a debugging round.
 * The URL is public (`NEXT_PUBLIC_`); the key is never logged.
 */
function announceTarget(url: string, schema: string) {
  const target = `${url}|${schema}`;
  if (announced.has(target)) return;
  announced.add(target);
  console.info("[one-account] identity spine", { url, schema });
}

export type IdentityAdminClient = ReturnType<typeof createIdentityAdminClient>;
