import { GutGuardReminders, GutGuardSubnav } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardPageData } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardRemindersPage() {
  const ctx = await requireMember("/gutguard-daily/reminders");
  const data = await loadGutGuardPageData(ctx.profile.id);

  return (
    <>
      <GutGuardSubnav activePath="/gutguard-daily/reminders" />
      <GutGuardReminders reminders={data.reminders} />
    </>
  );
}
