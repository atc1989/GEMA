import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Returns the public /e/[slug] path when any landing is published for the event. */
export async function getPublishedLandingPath(
  eventId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: landing }, { data: event }] = await Promise.all([
    supabase
      .from("ginhawa_landing")
      .select("source_event_id")
      .eq("source_event_id", eventId)
      .eq("published", true)
      .maybeSingle<{ source_event_id: string }>(),
    supabase
      .from("events")
      .select("slug")
      .eq("id", eventId)
      .maybeSingle<{ slug: string }>(),
  ]);

  if (!landing || !event?.slug) return null;
  return `/e/${event.slug}`;
}
