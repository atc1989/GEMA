"use server";

import { z } from "zod";

import { parseEventScheduling, type EventScheduling } from "@/lib/events/slots";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Live arrival-slot availability for a published event.
 *
 * Called on the server when the landing renders, and again from the booking
 * sheet whenever the guest's picked window is taken out from under them — the
 * grid a guest sees goes stale while they type their name.
 *
 * Returns null when the event is unknown, unpublished, or not scheduled.
 */
export async function loadEventScheduling(eventId: string): Promise<EventScheduling | null> {
  const parsed = z.string().uuid().safeParse(eventId);
  if (!parsed.success) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_event_slots", {
    p_event_id: parsed.data,
  });
  if (error || data == null) return null;

  return parseEventScheduling(data);
}
