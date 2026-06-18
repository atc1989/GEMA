"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  prospectRegistrationSchema,
  type ProspectRegistrationInput,
} from "@/lib/schemas/prospect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRegistrationQrToken } from "@/lib/qr/token";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type RegistrationSuccess = {
  passCode: string;
  qrToken: string;
  attendeeName: string;
  eventTitle: string;
  startsAt: string;
  timezone: string;
};

function newPassCode(): string {
  return `GEMA-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Public, anonymous prospect registration. Validates input, confirms the event
 * is open, generates the IDs + signed QR token (qr_payload) here in Node, then
 * delegates the atomic write to the register_prospect_for_event RPC.
 */
export async function registerProspectForEvent(
  input: ProspectRegistrationInput,
): Promise<ActionResult<RegistrationSuccess>> {
  const parsed = prospectRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const values = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, starts_at, timezone, status, visibility")
    .eq("id", values.eventId)
    .maybeSingle();

  if (eventError) return { ok: false, error: eventError.message };
  if (!event || event.status !== "published" || event.visibility !== "public") {
    return { ok: false, error: "This event is not open for registration." };
  }

  const prospectId = randomUUID();
  const registrationId = randomUUID();

  for (let attempt = 0; attempt < 2; attempt++) {
    const passCode = newPassCode();
    const qrToken = createRegistrationQrToken({
      registrationId,
      eventId: values.eventId,
      attendeeId: prospectId,
      kind: "prospect",
    });

    const { error } = await supabase.rpc("register_prospect_for_event", {
      p_event_id: values.eventId,
      p_full_name: values.fullName,
      p_phone: values.phone,
      p_email: values.email,
      p_city: values.city,
      p_consent_privacy: values.consentPrivacy,
      p_consent_marketing: values.consentMarketing ?? false,
      p_prospect_id: prospectId,
      p_registration_id: registrationId,
      p_pass_code: passCode,
      p_qr_payload: qrToken,
      p_ref_code: values.refCode ?? null,
    });

    if (!error) {
      return {
        ok: true,
        data: {
          passCode,
          qrToken,
          attendeeName: values.fullName,
          eventTitle: event.title,
          startsAt: event.starts_at,
          timezone: event.timezone,
        },
      };
    }

    // Retry once only on a pass-code/qr collision; otherwise surface a message.
    const message = error.message.toLowerCase();
    const isCollision =
      message.includes("duplicate") ||
      message.includes("unique") ||
      message.includes("pass_code") ||
      message.includes("qr_payload");
    if (!isCollision) {
      return { ok: false, error: friendlyDbError(error.message) };
    }
  }

  return { ok: false, error: "Could not complete registration. Please try again." };
}

function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("consent")) return "You must agree to the privacy terms to register.";
  if (m.includes("capacity")) return "Sorry, this event is fully booked.";
  if (m.includes("not open") || m.includes("not found")) {
    return "This event is not open for registration.";
  }
  return "Could not complete registration. Please try again.";
}
