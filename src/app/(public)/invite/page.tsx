import { CalendarDays } from "lucide-react";

import {
  PublicEventsList,
  type PublicEventRow,
} from "@/components/event/public-events-list";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PublicEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, event_type, starts_at, timezone, venue_name, mode, description")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("starts_at", { ascending: true })
    .limit(20)
    .returns<PublicEventRow[]>();

  const events = data ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Upcoming Events</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Open events available for registration.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming events"
          description="Check back soon — events will appear here once they're published."
        />
      ) : (
        <PublicEventsList events={events} />
      )}
    </div>
  );
}
