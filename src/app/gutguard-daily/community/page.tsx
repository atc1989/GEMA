import { GutGuardCommunity, GutGuardSubnav } from "@/features/gutguard-daily/components/gutguard-pages";
import { loadGutGuardPageData } from "@/features/gutguard-daily/services/load-gutguard-page-data";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardCommunityPage() {
  const ctx = await requireMember("/gutguard-daily/community");
  const data = await loadGutGuardPageData(ctx.profile.id);

  return (
    <>
      <GutGuardSubnav activePath="/gutguard-daily/community" />
      <GutGuardCommunity
        careRelationships={data.careRelationships}
        teamMembers={data.teamMembers}
        teams={data.teams}
      />
    </>
  );
}
