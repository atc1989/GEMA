"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  asPosterTemplateId,
  type PosterTemplateId,
} from "@/components/event/posters/types";

export type SetPosterResult =
  | { ok: true; template: PosterTemplateId }
  | { ok: false; error: string };

/**
 * Persists the host's chosen banner template into events.metadata.poster_template.
 * Only the event's host member may change it. No schema migration — metadata is jsonb.
 */
export async function setEventPosterTemplate(
  eventId: string,
  templateId: string,
): Promise<SetPosterResult> {
  const ctx = await getCurrentMember();
  if (!ctx) return { ok: false, error: "Not authorized." };

  const template = asPosterTemplateId(templateId);
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("metadata, host_member_id")
    .eq("id", eventId)
    .maybeSingle<{ metadata: Record<string, unknown>; host_member_id: string | null }>();

  if (!event || event.host_member_id !== ctx.member.id) {
    return { ok: false, error: "Event not found." };
  }

  const { error } = await supabase
    .from("events")
    .update({ metadata: { ...(event.metadata ?? {}), poster_template: template } })
    .eq("id", eventId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/member/events/${eventId}/banner`);
  return { ok: true, template };
}
