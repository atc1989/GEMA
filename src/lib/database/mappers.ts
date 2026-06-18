import type { Event } from "@/lib/database/types";
import type { EventFormValues } from "@/lib/schemas/event";

/** Raw shape of a `public.events` row as returned by Supabase (snake_case). */
export type EventRow = {
  id: string;
  created_by_profile_id: string;
  host_member_id: string | null;
  title: string;
  slug: string;
  event_type: Event["eventType"];
  visibility: Event["visibility"];
  mode: Event["mode"];
  status: Event["status"];
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  online_url: string | null;
  capacity: number | null;
  description: string | null;
  banner_url: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    createdByProfileId: row.created_by_profile_id,
    hostMemberId: row.host_member_id,
    title: row.title,
    slug: row.slug,
    eventType: row.event_type,
    visibility: row.visibility,
    mode: row.mode,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    mapUrl: row.map_url,
    onlineUrl: row.online_url,
    capacity: row.capacity,
    description: row.description,
    bannerUrl: row.banner_url,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Converts validated form values into a snake_case payload for insert/update.
 * `undefined` fields are converted to `null` so clearing a field persists.
 */
export function toEventRow(values: EventFormValues) {
  return {
    title: values.title,
    event_type: values.eventType,
    visibility: values.visibility,
    mode: values.mode,
    starts_at: new Date(values.startsAt).toISOString(),
    ends_at: values.endsAt ? new Date(values.endsAt).toISOString() : null,
    timezone: values.timezone,
    venue_name: values.venueName ?? null,
    venue_address: values.venueAddress ?? null,
    map_url: values.mapUrl ?? null,
    online_url: values.onlineUrl ?? null,
    capacity: values.capacity ?? null,
    description: values.description ?? null,
    banner_url: values.bannerUrl ?? null,
  };
}
