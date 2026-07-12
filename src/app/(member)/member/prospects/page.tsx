import {
  MemberProspectsView,
  type MemberProspect,
} from "@/components/prospect/member-prospects-view";
import { getCurrentMember } from "@/lib/auth/require-member";
import type { ProspectStage } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: ProspectStage;
  source: string | null;
  last_contacted_at: string | null;
  converted_member_id: string | null;
  created_at: string;
};

export default async function MemberProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const { data: prospects } = await supabase
    .from("prospects")
    .select(
      "id, full_name, email, phone, stage, source, last_contacted_at, converted_member_id, created_at",
    )
    .eq("sponsor_member_id", member.id)
    .order("created_at", { ascending: false })
    // ponytail: capped, not paginated — the client view's stage filters and counts
    // need the full set. Paginate when a member realistically exceeds 200 prospects.
    .limit(200)
    .returns<ProspectRow[]>();

  const rows: MemberProspect[] = (prospects ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    phone: p.phone,
    stage: p.converted_member_id ? "converted" : p.stage,
    source: p.source,
    lastContactedAt: p.last_contacted_at,
    convertedMemberId: p.converted_member_id,
    createdAt: p.created_at,
  }));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">My prospects</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Follow up with the people who registered through your referral links.
        </p>
      </div>

      <MemberProspectsView initialProspects={rows} focusId={focus ?? null} />
    </div>
  );
}
