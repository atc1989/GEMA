import { headers } from "next/headers";

import {
  eventToFormValues,
  landingToFormValues,
  mapLandingRow,
  type EventPrefill,
  type GinhawaLandingRow,
  type SpeakerPrefill,
} from "@/lib/ginhawa/prefill";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GinhawaLandingFormInput } from "@/lib/schemas/ginhawa-landing";

async function requestPublicOrigin(): Promise<string | undefined> {
  if (process.env.GEMA_PUBLIC_ORIGIN) return process.env.GEMA_PUBLIC_ORIGIN;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return undefined;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function loadGinhawaLandingForm(
  eventId: string,
): Promise<{ values: GinhawaLandingFormInput; eventTitle: string } | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: event }, { data: speakers }, { data: landingRow }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, starts_at, timezone, description, capacity, venue_name, venue_address, map_url",
      )
      .eq("id", eventId)
      .maybeSingle<EventPrefill>(),
    supabase
      .from("event_speakers")
      .select("id, name, role_title, photo_url")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .returns<SpeakerPrefill[]>(),
    supabase.from("ginhawa_landing").select("*").eq("id", true).maybeSingle<GinhawaLandingRow>(),
  ]);

  if (!event) return null;

  const origin = await requestPublicOrigin();
  const landing = landingRow ? mapLandingRow(landingRow) : null;
  const values =
    landing?.sourceEventId === event.id
      ? landingToFormValues(landing, origin)
      : eventToFormValues(event, speakers ?? [], landing, origin);

  return { values, eventTitle: event.title };
}
