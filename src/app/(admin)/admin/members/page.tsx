import Link from "next/link";
import { ChevronRight, IdCard, Upload } from "lucide-react";

import { SetPasswordButton } from "@/components/admin/set-password-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cleanPage, cleanPerPage, DEFAULT_PER_PAGE, Pagination } from "@/components/ui/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function pageHref(page: number, perPage: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("per", String(perPage));
  const suffix = params.toString();
  return suffix ? `/admin/members?${suffix}` : "/admin/members";
}

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

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const { page: rawPage, per: rawPer } = await searchParams;
  const page = cleanPage(rawPage);
  const perPage = cleanPerPage(rawPer);
  const from = (page - 1) * perPage;

  const supabase = await createSupabaseServerClient();

  const { data: members, count } = await supabase
    .from("members")
    .select("id, username, member_code, status, profile_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1)
    .returns<MemberRow[]>();

  const rows = members ?? [];

  let prospectAgg: ProspectAggRow[] = [];
  if (rows.length > 0) {
    const { data } = await supabase
      .from("prospects")
      .select("sponsor_member_id, source, converted_member_id")
      .in(
        "sponsor_member_id",
        rows.map((m) => m.id),
      )
      .returns<ProspectAggRow[]>();
    prospectAgg = data ?? [];
  }

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black tracking-tight">Members</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Open a member to see their prospects and referral performance, or set a temporary
            login password.
          </p>
        </div>
        <Link
          href="/admin/members/import"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
        >
          <Upload className="size-3.5" aria-hidden="true" />
          Import credentials
        </Link>
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
      <Pagination page={page} count={count ?? 0} perPage={perPage} hrefFor={pageHref} />
    </div>
  );
}
