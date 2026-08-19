import Link from "next/link";
import { CalendarPlus, CalendarX } from "lucide-react";

import { EventListItem } from "@/components/event/event-list-item";
import { ExportReportMenu } from "@/components/event/export-report-menu";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { cleanPage, cleanPerPage, DEFAULT_PER_PAGE, Pagination } from "@/components/ui/pagination";
import { eventTimeOrFilter } from "@/lib/event-time-filter";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileDisplayName } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

const FILTERS: { key: string; label: string; status?: EventStatus }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", status: "draft" },
  { key: "published", label: "Published", status: "published" },
  { key: "cancelled", label: "Cancelled", status: "cancelled" },
  { key: "finished", label: "Finished" },
  { key: "archived", label: "Archived", status: "archived" },
];

/**
 * An event is finished once its end time has passed — or its start time, when
 * it is open-ended. Expressed as a PostgREST `or` group so the split happens in
 * the database and pagination stays correct.
 */
function timeFilter(now: string, finished: boolean) {
  return eventTimeOrFilter(now, finished);
}

function pageHref(page: number, perPage: number, statusKey: string) {
  const params = new URLSearchParams();
  if (statusKey !== "all") params.set("status", statusKey);
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("per", String(perPage));
  const suffix = params.toString();
  return suffix ? `/admin/events?${suffix}` : "/admin/events";
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; per?: string }>;
}) {
  const { status, page: rawPage, per: rawPer } = await searchParams;
  const active = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const page = cleanPage(rawPage);
  const perPage = cleanPerPage(rawPer);
  const from = (page - 1) * perPage;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select("*, profiles!created_by_profile_id(id, first_name, last_name, full_name, email)", { count: "exact" })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("starts_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (active.status) query = query.eq("status", active.status);

  // Archived events live only in their own tab; finished ones only in theirs.
  if (active.key !== "archived") {
    query = query.neq("status", "archived").or(timeFilter(new Date().toISOString(), active.key === "finished"));
  }

  const { data, error, count } = await query.returns<
    (EventRow & {
      profiles: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        email: string | null;
      } | null;
    })[]
  >();
  const events = (data ?? []).map((row) => ({
    ...mapEventRow(row),
    creatorName: profileDisplayName(row.profiles),
  }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          className="w-full sm:w-auto"
          activeKey={active.key}
          tabs={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            href: pageHref(1, perPage, f.key),
          }))}
        />
        <div className="flex items-center gap-2">
          <ExportReportMenu href="/api/events-report" />
          <Link
            href="/admin/events/new"
            className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
          >
            <CalendarPlus aria-hidden="true" />
            Create Event
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-destructive">
          Failed to load events: {error.message}
        </p>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={active.key === "all" ? "No events yet" : `No ${active.label.toLowerCase()} events`}
          description={
            active.key === "all"
              ? "Create your first event to start managing registrations and attendance."
              : "Nothing here right now. Try another tab."
          }
        />
      ) : (
        <>
          <div className="grid gap-3">
            {events.map(({ creatorName, ...event }) => (
              <EventListItem key={event.id} event={event} creatorName={creatorName} />
            ))}
          </div>
          <Pagination
            page={page}
            count={count ?? 0}
            perPage={perPage}
            hrefFor={(p, n) => pageHref(p, n, active.key)}
          />
        </>
      )}
    </div>
  );
}
