import Link from "next/link";
import { CalendarDays, MapPin, Monitor, Ticket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type PublicEventRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  mode: string;
  description: string | null;
};

export default async function PublicEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, starts_at, timezone, venue_name, mode, description")
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
        <div className="grid gap-3">
          {events.map((ev) => {
            const LocationIcon = ev.mode === "online" ? Monitor : MapPin;
            const location =
              ev.mode === "online" ? "Online event" : ev.venue_name ?? "Venue TBA";

            return (
              <Card key={ev.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold leading-5">{ev.title}</h3>
                    <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatEventDateTime(ev.starts_at, ev.timezone)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <LocationIcon className="size-3.5" aria-hidden="true" />
                        {location}
                      </span>
                    </div>
                    {ev.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {ev.description}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <Link
                        href={`/invite/${ev.id}`}
                        className={cn(
                          buttonVariants({ variant: "brand", size: "sm" }),
                          "h-7 text-xs",
                        )}
                      >
                        <Ticket className="size-3.5" aria-hidden="true" />
                        View &amp; register
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
