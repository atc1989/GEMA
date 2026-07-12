import Link from "next/link";
import { CalendarPlus, CalendarX } from "lucide-react";

import { EventListItem } from "@/components/event/event-list-item";
import { ExportReportMenu } from "@/components/event/export-report-menu";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { cleanPage, Pagination } from "@/components/ui/pagination";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

const PAGE_SIZE = 20;

const FILTERS: { key: string; label: string; status?: EventStatus }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", status: "draft" },
  { key: "published", label: "Published", status: "published" },
  { key: "cancelled", label: "Cancelled", status: "cancelled" },
];

function pageHref(page: number, statusKey: string) {
  const params = new URLSearchParams();
  if (statusKey !== "all") params.set("status", statusKey);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/events?${suffix}` : "/admin/events";
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: rawPage } = await searchParams;
  const active = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const page = cleanPage(rawPage);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select("*", { count: "exact" })
    .order("starts_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (active.status) query = query.eq("status", active.status);

  const { data, error, count } = await query.returns<EventRow[]>();
  const events = (data ?? []).map(mapEventRow);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          className="w-full sm:w-auto"
          activeKey={active.key}
          tabs={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            href: pageHref(1, f.key),
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
          <Pagination page={page} totalPages={totalPages} hrefFor={(p) => pageHref(p, active.key)} />
        </>
      )}
    </div>
  );
}
