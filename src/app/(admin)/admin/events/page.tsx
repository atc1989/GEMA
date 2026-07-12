import Link from "next/link";
import { CalendarPlus, CalendarX } from "lucide-react";

import { EventListItem } from "@/components/event/event-list-item";
import { ExportReportMenu } from "@/components/event/export-report-menu";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { cleanPage, cleanPerPage, DEFAULT_PER_PAGE, Pagination } from "@/components/ui/pagination";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

const FILTERS: { key: string; label: string; status?: EventStatus }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", status: "draft" },
  { key: "published", label: "Published", status: "published" },
  { key: "cancelled", label: "Cancelled", status: "cancelled" },
];

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
    .select("*", { count: "exact" })
    .order("starts_at", { ascending: false })
    .range(from, from + perPage - 1);
  if (active.status) query = query.eq("status", active.status);

  const { data, error, count } = await query.returns<EventRow[]>();
  const events = (data ?? []).map(mapEventRow);

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
          title="No events yet"
          description="Create your first event to start managing registrations and attendance."
        />
      ) : (
        <>
          <div className="grid gap-3">
            {events.map((event) => (
              <EventListItem key={event.id} event={event} />
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
