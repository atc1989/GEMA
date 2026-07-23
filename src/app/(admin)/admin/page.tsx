import Link from "next/link";
import { BarChart3, CalendarClock, CalendarDays, LogOut, UserCheck, Users } from "lucide-react";

import { EventListItem } from "@/components/event/event-list-item";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { mapEventRow, type EventRow } from "@/lib/database/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminPage() {
  const [profile, supabase] = await Promise.all([
    getCurrentProfile(), // deduplicated via React cache() — no extra DB call
    createSupabaseServerClient(),
  ]);

  const [
    { count: eventCount },
    { count: publishedCount },
    { count: pendingCount },
    { count: prospectCount },
    { count: memberCount },
    { count: commissionCount },
    { count: paidCommissionCount },
    { data: upcomingRows },
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase.from("prospects").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("commissions").select("id", { count: "exact", head: true }),
    supabase
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "paid"]),
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5)
      .returns<EventRow[]>(),
  ]);

  const upcomingEvents = (upcomingRows ?? []).map(mapEventRow);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">
          Signed in as {profile?.fullName ?? profile?.email ?? "admin"}
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DashboardCard
          icon={CalendarDays}
          label="Events"
          value={String(eventCount ?? 0)}
          helper={`${publishedCount ?? 0} published`}
        />
        <DashboardCard
          icon={CalendarClock}
          label="Pending approval"
          value={String(pendingCount ?? 0)}
          helper="awaiting review"
          tone="gold"
        />
        <DashboardCard
          icon={Users}
          label="Prospects"
          value={String(prospectCount ?? 0)}
          helper="registered leads"
          tone="success"
        />
        <DashboardCard
          icon={UserCheck}
          label="Members"
          value={String(memberCount ?? 0)}
          helper="converted"
          tone="purple"
        />
        <DashboardCard
          icon={BarChart3}
          label="Commissions"
          value={String(commissionCount ?? 0)}
          helper={`${paidCommissionCount ?? 0} approved/paid`}
          tone="gold"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/events"
          className={cn(buttonVariants({ variant: "brand" }), "w-fit")}
        >
          <CalendarDays aria-hidden="true" />
          Manage events
        </Link>
        <Link
          href="/admin/calendar"
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          <CalendarClock aria-hidden="true" />
          View calendar
        </Link>
      </div>

      <section className="grid gap-2">
        <h2 className="text-sm font-black tracking-tight">Upcoming events</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm font-semibold text-muted-foreground">
            No published events coming up.
          </p>
        ) : (
          <div className="grid gap-2">
            {upcomingEvents.map((event) => (
              <EventListItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
