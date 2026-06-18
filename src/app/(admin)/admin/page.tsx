import Link from "next/link";
import { BarChart3, CalendarDays, LogOut, UserCheck, Users } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminPage() {
  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createSupabaseServerClient(),
  ]);

  const [
    { count: eventCount },
    { count: publishedCount },
    { count: prospectCount },
    { count: memberCount },
    { count: commissionCount },
    { count: paidCommissionCount },
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase.from("prospects").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("commissions").select("id", { count: "exact", head: true }),
    supabase
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "paid"]),
  ]);

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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardCard
          icon={CalendarDays}
          label="Events"
          value={String(eventCount ?? 0)}
          helper={`${publishedCount ?? 0} published`}
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

      <Link
        href="/admin/events"
        className={cn(buttonVariants({ variant: "brand" }), "w-fit")}
      >
        <CalendarDays aria-hidden="true" />
        Manage events
      </Link>
    </div>
  );
}
