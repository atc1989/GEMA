import type { SupabaseClient } from "@supabase/supabase-js";

/** Turns a title into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Returns a slug for `title` guaranteed unique against `events.slug`. Appends a
 * short random suffix when the base (or a collision) already exists.
 * `ignoreId` lets an event keep/regenerate its own slug on edit.
 *
 * Uses the security-definer `event_slug_exists` RPC: a plain select here runs
 * under RLS, which hides drafts and other users' events, so it would miss
 * collisions and the insert would blow up on `events_slug_key`.
 */
export async function ensureUniqueEventSlug(
  supabase: SupabaseClient,
  title: string,
  ignoreId?: string,
): Promise<string> {
  const base = slugify(title) || "event";

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    const { data: exists, error } = await supabase.rpc("event_slug_exists", {
      p_slug: candidate,
      p_ignore_id: ignoreId ?? null,
    });
    if (error) throw error;
    if (!exists) return candidate;
  }

  // Extremely unlikely fallback.
  return `${base}-${Date.now().toString(36)}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}
