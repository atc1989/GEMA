"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyRegistrationQrToken } from "@/lib/qr/token";
import type { RegistrationKind, RegistrationStatus } from "@/lib/database/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AttendeePreview = {
  registrationId: string;
  attendeeName: string;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  kind: RegistrationKind;
  registrationStatus: RegistrationStatus;
  alreadyCheckedIn: boolean;
  checkedInAt: string | null;
};

export type CheckInResult = {
  status: "checked_in" | "already";
  checkedInAt: string | null;
};

const lookupSchema = z
  .object({
    eventId: z.string().uuid(),
    token: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.token) || Boolean(v.code), {
    message: "Scan a QR code or enter a confirmation code.",
  });

/** Permission gate usable inside actions (returns an error result instead of redirecting). */
async function canManage(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "You must be signed in." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("can_manage_event", {
    target_event_id: eventId,
  });
  if (error || data !== true) {
    return { ok: false, error: "You are not authorized to manage this event." };
  }
  return { ok: true };
}

/**
 * Resolves a scanned QR token (or manually entered pass code) to a registration
 * for this event, returning the attendee details to confirm before check-in.
 * Signature is verified for tokens before any DB access.
 */
export async function lookupRegistrationForCheckIn(input: {
  eventId: string;
  token?: string;
  code?: string;
}): Promise<ActionResult<AttendeePreview>> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { eventId, token, code } = parsed.data;

  const perm = await canManage(eventId);
  if (!perm.ok) return perm;

  // For QR tokens, verify the signature first (tamper-evident) and ensure the
  // embedded event id matches the event being scanned for.
  if (token) {
    const decoded = verifyRegistrationQrToken(token);
    if (!decoded) {
      return { ok: false, error: "Invalid or tampered QR code." };
    }
    if (decoded.eventId !== eventId) {
      return { ok: false, error: "This QR code is for a different event." };
    }
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("event_registrations")
    .select(
      "id, attendee_name, attendee_email, attendee_phone, registration_kind, status",
    )
    .eq("event_id", eventId);

  query = token
    ? query.eq("qr_payload", token)
    : query.eq("pass_code", (code ?? "").toUpperCase());

  const { data: reg, error } = await query.maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  if (!reg) {
    return { ok: false, error: "No matching registration found for this event." };
  }

  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("checked_in_at")
    .eq("registration_id", reg.id)
    .maybeSingle();

  return {
    ok: true,
    data: {
      registrationId: reg.id,
      attendeeName: reg.attendee_name,
      attendeeEmail: reg.attendee_email,
      attendeePhone: reg.attendee_phone,
      kind: reg.registration_kind,
      registrationStatus: reg.status,
      alreadyCheckedIn: Boolean(attendance),
      checkedInAt: attendance?.checked_in_at ?? null,
    },
  };
}

/** Records attendance atomically via the SECURITY DEFINER record_attendance RPC. */
export async function recordAttendance(input: {
  eventId: string;
  registrationId: string;
  deviceId?: string;
}): Promise<ActionResult<CheckInResult>> {
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      registrationId: z.string().uuid(),
      deviceId: z.string().trim().max(120).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const perm = await canManage(parsed.data.eventId);
  if (!perm.ok) return perm;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("record_attendance", {
    p_event_id: parsed.data.eventId,
    p_registration_id: parsed.data.registrationId,
    p_device_id: parsed.data.deviceId ?? null,
  });

  if (error) {
    return { ok: false, error: friendlyDbError(error.message) };
  }

  const result = data as { status: "checked_in" | "already"; checked_in_at: string };
  revalidatePath(`/admin/events/${parsed.data.eventId}/attendance`);
  revalidatePath(`/member/events/${parsed.data.eventId}/attendance`);

  return {
    ok: true,
    data: { status: result.status, checkedInAt: result.checked_in_at ?? null },
  };
}

/**
 * Soft-removes a registration (status -> cancelled). Cancelled registrations
 * disappear from attendance lists, free up capacity, and their QR pass is
 * rejected at check-in. RLS (registrations_manage_event) enforces the same
 * can_manage_event gate server-side.
 */
export async function cancelRegistration(input: {
  eventId: string;
  registrationId: string;
}): Promise<ActionResult<null>> {
  const parsed = z
    .object({ eventId: z.string().uuid(), registrationId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const perm = await canManage(parsed.data.eventId);
  if (!perm.ok) return perm;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_registrations")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.registrationId)
    .eq("event_id", parsed.data.eventId)
    .neq("status", "cancelled")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  if (!data) return { ok: false, error: "Registration not found or already removed." };

  revalidatePath(`/admin/events/${parsed.data.eventId}/attendance`);
  revalidatePath(`/member/events/${parsed.data.eventId}/attendance`);
  return { ok: true, data: null };
}

function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not authorized")) return "You are not authorized to manage this event.";
  if (m.includes("cancelled")) return "This event or registration has been cancelled.";
  if (m.includes("ended")) return "This event has already ended.";
  if (m.includes("not found")) return "Registration or event not found.";
  return "Could not record attendance. Please try again.";
}
