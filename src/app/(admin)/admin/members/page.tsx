import Link from "next/link";
import { ChevronRight, IdCard } from "lucide-react";

import { SetPasswordButton } from "@/components/admin/set-password-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  username: string;
  member_code: string;
  status: string;
  profile_id: string;
};

type ProspectAggRow = {
  sponsor_member_id: string;
  source: string | null;
  converted_member_id: string | null;
};

type MemberStats = { total: number; viaLinks: number; converted: number };

export default async function AdminMembersPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: members }, { data: prospectAgg }] = await Promise.all([
    supabase
      .from("members")
      .select("id, username, member_code, status, profile_id")
      .order("created_at", { ascending: false })
      .returns<MemberRow[]>(),
    supabase
      .from("prospects")
      .select("sponsor_member_id, source, converted_member_id")
      .not("sponsor_member_id", "is", null)
      .returns<ProspectAggRow[]>(),
  ]);

  const rows = members ?? [];

  // ponytail: aggregate in JS; move to a grouped RPC if prospects reach many thousands.
  const statsByMember = new Map<string, MemberStats>();
  for (const p of prospectAgg ?? []) {
    const s = statsByMember.get(p.sponsor_member_id) ?? {
      total: 0,
      viaLinks: 0,
      converted: 0,
    };
    s.total++;
    if (p.source === "member_referral") s.viaLinks++;
    if (p.converted_member_id) s.converted++;
    statsByMember.set(p.sponsor_member_id, s);
  }

  const emailById = new Map<string, string>();
  const profileIds = rows.map((m) => m.profile_id);
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", profileIds)
      .returns<{ id: string; email: string | null }[]>();
    for (const p of profiles ?? []) emailById.set(p.id, p.email ?? "—");
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Members</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Open a member to see their prospects and referral performance, or set a temporary
          login password.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title="No members yet"
          description="Members appear here after onboarding or prospect conversion."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((m) => {
              const stats = statsByMember.get(m.id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/admin/members/${m.id}`} className="group min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-bold group-hover:text-brand">
                      @{m.username}
                      <ChevronRight
                        className="size-3.5 shrink-0 text-muted-foreground group-hover:text-brand"
                        aria-hidden="true"
                      />
                    </p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {emailById.get(m.profile_id) ?? "—"} · {m.member_code}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-brand">
                      {stats
                        ? `${stats.total} prospect${stats.total === 1 ? "" : "s"} · ${stats.viaLinks} via links · ${stats.converted} converted`
                        : "No prospects yet"}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                      {m.status}
                    </span>
                    <SetPasswordButton memberId={m.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
