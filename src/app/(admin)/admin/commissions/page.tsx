import Link from "next/link";
import { Coins } from "lucide-react";

import {
  CommissionRow,
  type CommissionStatus,
  type CommissionView,
} from "@/components/commission/commission-row";
import { CommissionStats } from "@/components/commission/commission-stats";
import { BulkCommissionActions } from "@/components/commission/bulk-commission-actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cleanPage, Pagination } from "@/components/ui/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type CommissionRowData = {
  id: string;
  earner_member_id: string;
  source_member_id: string | null;
  level_depth: number;
  amount: string;
  currency: string;
  status: CommissionStatus;
};

const FILTERS: { key: string; label: string; status?: CommissionStatus }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", status: "pending" },
  { key: "approved", label: "Approved", status: "approved" },
  { key: "paid", label: "Paid", status: "paid" },
  { key: "reversed", label: "Reversed", status: "reversed" },
];

function pageHref(page: number, statusKey: string) {
  const params = new URLSearchParams();
  if (statusKey !== "all") params.set("status", statusKey);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/commissions?${suffix}` : "/admin/commissions";
}

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: rawPage } = await searchParams;
  const active = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const page = cleanPage(rawPage);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("commissions")
    .select("id, earner_member_id, source_member_id, level_depth, amount, currency, status", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (active.status) query = query.eq("status", active.status);

  // ponytail: totals still scan amount+status of every row; swap for an aggregate RPC
  // if commissions reach tens of thousands.
  const [{ data: commissions, count }, { data: allAmounts }] = await Promise.all([
    query.returns<CommissionRowData[]>(),
    supabase
      .from("commissions")
      .select("amount, status")
      .returns<{ amount: string; status: CommissionStatus }[]>(),
  ]);

  const rows = commissions ?? [];
  const totals = allAmounts ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Resolve member display names in one query.
  const memberIds = Array.from(
    new Set(rows.flatMap((r) => [r.earner_member_id, r.source_member_id].filter(Boolean))),
  ) as string[];
  const nameById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, username, member_code")
      .in("id", memberIds)
      .returns<{ id: string; username: string; member_code: string }[]>();
    for (const m of members ?? []) nameById.set(m.id, m.username ?? m.member_code);
  }

  const sumBy = (s: CommissionStatus) =>
    totals.filter((r) => r.status === s).reduce((acc, r) => acc + Number(r.amount), 0);

  const views: CommissionView[] = rows.map((r) => ({
    id: r.id,
    earnerName: nameById.get(r.earner_member_id) ?? "Member",
    sourceName: r.source_member_id ? nameById.get(r.source_member_id) ?? "Member" : "—",
    level: r.level_depth,
    amount: Number(r.amount).toFixed(2),
    currency: r.currency,
    status: r.status,
  }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Commissions</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Multi-level payouts generated when prospects convert to members.
        </p>
      </div>

      <CommissionStats
        pendingTotal={sumBy("pending")}
        approvedTotal={sumBy("approved")}
        paidTotal={sumBy("paid")}
      />

      <BulkCommissionActions
        pendingCount={totals.filter((r) => r.status === "pending").length}
        approvedCount={totals.filter((r) => r.status === "approved").length}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={pageHref(1, f.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              active.key === f.key
                ? "bg-secondary text-brand"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {views.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No commissions"
          description="Convert a prospect to a member to generate upline commissions."
        />
      ) : (
        <>
          <Card className="p-0">
            <ul className="divide-y divide-border/60">
              {views.map((c) => (
                <CommissionRow key={c.id} commission={c} showActions />
              ))}
            </ul>
          </Card>
          <Pagination page={page} totalPages={totalPages} hrefFor={(p) => pageHref(p, active.key)} />
        </>
      )}
    </div>
  );
}
