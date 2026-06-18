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
 */
export async function ensureUniqueEventSlug(
  supabase: SupabaseClient,
  title: string,
  ignoreId?: string,
): Promise<string> {
  const base = slugify(title) || "event";

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    let query = supabase.from("events").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
  }

  // Extremely unlikely fallback.
  return `${base}-${Date.now().toString(36)}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}
