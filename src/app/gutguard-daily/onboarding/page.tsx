import { GutGuardOnboarding, GutGuardSubnav } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardPageData } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardOnboardingPage() {
  const ctx = await requireMember("/gutguard-daily/onboarding");
  const data = await loadGutGuardPageData(ctx.profile.id);

  return (
    <>
      <GutGuardSubnav activePath="/gutguard-daily/onboarding" />
      <GutGuardOnboarding progress={data.onboarding} />
    </>
  );
}
