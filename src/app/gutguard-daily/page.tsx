import { AppShell } from "@/components/shell/app-shell";
import { SidebarSignOutButton } from "@/components/shell/sidebar-sign-out-button";
import { GutGuardDailyDashboard } from "@/features/gutguard-daily/components/gutguard-daily-dashboard";
import { createDailyHealthService } from "@/features/gutguard-daily/services/create-daily-health-service";
import { requireMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
    label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export default async function GutGuardDailyPage() {
  const ctx = await requireMember("/gutguard-daily");
  const supabase = await createSupabaseServerClient();
  const dailyHealthService = createDailyHealthService(supabase);
  const range = getMonthRange();

  const [doses, reminders] = await Promise.all([
    dailyHealthService.getDoses(ctx.profile.id, range.from, range.to),
    dailyHealthService.getReminders(ctx.profile.id),
  ]);

  if (doses.error || reminders.error) {
    throw doses.error ?? reminders.error;
  }

  return (
    <AppShell
      eyebrow="GutGuard Daily"
      role="member"
      subtitle="Daily dose tracking connected to your authenticated GEMA account."
      title="GutGuard Daily"
      user={{
        name: ctx.profile.fullName ?? ctx.profile.email ?? "Member",
        email: ctx.profile.email ?? "",
        role: "Member",
      }}
      signOutSlot={<SidebarSignOutButton />}
    >
      <GutGuardDailyDashboard
        doses={doses.data ?? []}
        monthLabel={range.label}
        reminders={reminders.data ?? []}
      />
    </AppShell>
  );
}
