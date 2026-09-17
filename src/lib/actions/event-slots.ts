"use server";

import { revalidatePath } from "next/cache";
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

/**
 * Opens or closes one arrival window — lunch, a staff meeting, a clinician
 * stepping out. Closed windows come off the public picker immediately and stop
 * counting toward capacity the next time the grid is regenerated.
 *
 * Only empty windows can be closed. Closing one that already holds a booking
 * would leave that guest with a pass to a window nobody is working, so the
 * check lives here and the button is disabled in the UI as well.
 */
export async function setEventSlotClosed(
  eventId: string,
  slotId: string,
  closed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = z.object({ eventId: z.string().uuid(), slotId: z.string().uuid() });
  const parsed = ids.safeParse({ eventId, slotId });
  if (!parsed.success) return { ok: false, error: "Unknown window." };

  const supabase = await createSupabaseServerClient();

  if (closed) {
    const { data: slot } = await supabase
      .from("event_slots")
      .select("seats_taken")
      .eq("id", parsed.data.slotId)
      .maybeSingle<{ seats_taken: number }>();
    if (slot && slot.seats_taken > 0) {
      return { ok: false, error: "Someone is booked into this window. Cancel the booking first." };
    }
  }

  const { error } = await supabase.rpc("set_event_slot_closed", {
    p_slot_id: parsed.data.slotId,
    p_closed: closed,
  });
  if (error) {
    console.error("set_event_slot_closed failed:", error.code, error.message);
    return { ok: false, error: "Could not change that window. Try again." };
  }

  revalidatePath(`/admin/events/${parsed.data.eventId}/schedule`);
  return { ok: true };
}
