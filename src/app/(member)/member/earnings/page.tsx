import { Coins } from "lucide-react";

import {
  CommissionRow,
  type CommissionStatus,
  type CommissionView,
} from "@/components/commission/commission-row";
import { CommissionStats } from "@/components/commission/commission-stats";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CommissionRowData = {
  id: string;
  source_member_id: string | null;
  level_depth: number;
  amount: string;
  currency: string;
  status: CommissionStatus;
};

export default async function MemberEarningsPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const { data: commissions } = await supabase
    .from("commissions")
    .select("id, source_member_id, level_depth, amount, currency, status")
    .eq("earner_member_id", member.id)
    .order("created_at", { ascending: false })
    .returns<CommissionRowData[]>();

  const rows = commissions ?? [];

  const nameById = new Map<string, string>();
  const sourceIds = Array.from(
    new Set(rows.map((r) => r.source_member_id).filter(Boolean)),
  ) as string[];
  if (sourceIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, username, member_code")
      .in("id", sourceIds)
      .returns<{ id: string; username: string; member_code: string }[]>();
    for (const m of members ?? []) nameById.set(m.id, m.username ?? m.member_code);
  }

  const sumBy = (s: CommissionStatus) =>
    rows.filter((r) => r.status === s).reduce((acc, r) => acc + Number(r.amount), 0);

  const views: CommissionView[] = rows.map((r) => ({
    id: r.id,
    earnerName: `@${member.username}`,
    sourceName: r.source_member_id ? nameById.get(r.source_member_id) ?? "Member" : "—",
    level: r.level_depth,
    amount: Number(r.amount).toFixed(2),
    currency: r.currency,
    status: r.status,
  }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">My earnings</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Commissions from your downline conversions.
        </p>
      </div>

      <CommissionStats
        pendingTotal={sumBy("pending")}
        approvedTotal={sumBy("approved")}
        paidTotal={sumBy("paid")}
      />

      {views.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No earnings yet"
          description="When prospects in your downline convert to members, your commissions appear here."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {views.map((c) => (
              <CommissionRow key={c.id} commission={c} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
