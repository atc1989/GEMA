import { GinhawaLandingEditor } from "@/components/ginhawa/ginhawa-landing-editor";
import { GinhawaPublishedBanner } from "@/components/ginhawa/ginhawa-published-banner";
import { mapLandingRow, type GinhawaLandingRow } from "@/lib/ginhawa/prefill";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventStatus } from "@/lib/database/types";

type EventPickRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: EventStatus;
  venue_name: string | null;
};

export default async function AdminGinhawaPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: landingRow }, { data: eventRows }] = await Promise.all([
    supabase.from("ginhawa_landing").select("*").eq("id", true).maybeSingle<GinhawaLandingRow>(),
    supabase
      .from("events")
      .select("id, title, starts_at, timezone, status, venue_name")
      .neq("status", "archived")
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<EventPickRow[]>(),
  ]);

  const landing = landingRow ? mapLandingRow(landingRow) : null;
  const events = (eventRows ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    timezone: event.timezone,
    status: event.status,
    venueName: event.venue_name,
  }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Ginhawa landing</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Pick an event, edit the public copy, then publish. Ginhawa stays a separate site and reads
          this snapshot.
        </p>
      </div>

      {landing?.published ? (
        <GinhawaPublishedBanner eventTitle={landing.title} publishedAt={landing.publishedAt} />
      ) : null}

      <GinhawaLandingEditor events={events} landing={landing} />
    </div>
  );
}
