import type { EventLandingFieldsInput } from "@/lib/schemas/event";
import { defaultEventLandingFields } from "@/lib/schemas/event";
import {
  mapLandingRow,
  type GinhawaLandingRow,
} from "@/lib/ginhawa/prefill";
import { asLandingTemplate } from "@/lib/ginhawa/templates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Loads medical landing form defaults for an event edit page (draft or published). */
export async function loadEventLandingDefaults(
  eventId: string,
): Promise<EventLandingFieldsInput> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ginhawa_landing")
    .select("*")
    .eq("source_event_id", eventId)
    .maybeSingle<GinhawaLandingRow>();

  if (!data) return defaultEventLandingFields();

  const landing = mapLandingRow(data);
  return defaultEventLandingFields({
    enabled: true,
    template: landing.template ? asLandingTemplate(landing.template) : "session",
    heroWhat: landing.heroWhat,
    giftPoints: landing.giftPoints,
    giftPeso: landing.giftPeso,
    clinicians: landing.clinicians.map((c) => ({
      id: c.id,
      name: c.name,
      suffix: c.suffix,
      role: c.role,
      initials: c.initials,
      photo: c.photo ?? "",
      licence: c.licence,
      credentialsMd: c.credentialsMd,
    })),
    videoUrl: landing.videoUrl ?? "",
    videoLength: landing.videoLength ?? "",
    videoCaption: landing.videoCaption ?? "",
    askTitle: landing.askTitle,
    askBody: landing.askBody,
    askHit: landing.askHit,
    gutTitle: landing.gutTitle,
    gutBody: landing.gutBody,
    gutClose: landing.gutClose,
  });
}
