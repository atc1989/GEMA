import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarPlus, CalendarX2, CalendarDays } from "lucide-react";

import { AdminMonthAgenda } from "@/components/calendar/admin-month-agenda";
import { AdminMonthCalendar } from "@/components/calendar/admin-month-calendar";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ExportReportMenu } from "@/components/event/export-report-menu";
import { buttonVariants } from "@/components/ui/button";
import { buildAdminMonth } from "@/lib/calendar/admin-month";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const data = await buildAdminMonth(supabase, month);

  const published = data.events.filter((e) => e.status === "published").length;
  const pending = data.events.filter((e) => e.status === "draft").length;
  const cancelled = data.events.filter((e) => e.status === "cancelled").length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-black tracking-tight">Calendar</h1>
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardCard icon={CalendarDays} label="This month" value={String(data.events.length)} />
        <DashboardCard
          icon={CalendarCheck2}
          label="Published"
          value={String(published)}
          tone="success"
        />
        <DashboardCard
          icon={CalendarClock}
          label="Pending approval"
          value={String(pending)}
          tone="gold"
        />
        <DashboardCard icon={CalendarX2} label="Cancelled" value={String(cancelled)} tone="purple" />
      </section>

      <AdminMonthCalendar month={data} />

      <AdminMonthAgenda events={data.events} />
    </div>
  );
}
