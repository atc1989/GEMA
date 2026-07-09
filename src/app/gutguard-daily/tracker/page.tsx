import { GutGuardSubnav, GutGuardTracker } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardPageData } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardTrackerPage() {
  const ctx = await requireMember("/gutguard-daily/tracker");
  const data = await loadGutGuardPageData(ctx.profile.id);

  return (
    <>
      <GutGuardSubnav activePath="/gutguard-daily/tracker" />
      <GutGuardTracker data={data} />
    </>
  );
}
