import { GutGuardOverview, GutGuardSubnav } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardPageData } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardDailyPage() {
  const ctx = await requireMember("/gutguard-daily");
  const data = await loadGutGuardPageData(ctx.profile.id);

  return (
    <>
      <GutGuardSubnav activePath="/gutguard-daily" />
      <GutGuardOverview data={data} />
    </>
  );
}
