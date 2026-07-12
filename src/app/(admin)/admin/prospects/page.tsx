import { Users } from "lucide-react";

import { ConvertProspectButton } from "@/components/prospect/convert-prospect-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cleanPage, cleanPerPage, DEFAULT_PER_PAGE, Pagination } from "@/components/ui/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

function pageHref(page: number, perPage: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("per", String(perPage));
  const suffix = params.toString();
  return suffix ? `/admin/prospects?${suffix}` : "/admin/prospects";
}

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  stage: string;
  created_at: string;
  converted_member_id: string | null;
  sponsor_member_id: string | null;
};

export default async function AdminProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const { page: rawPage, per: rawPer } = await searchParams;
  const page = cleanPage(rawPage);
  const perPage = cleanPerPage(rawPer);
  const from = (page - 1) * perPage;

  const supabase = await createSupabaseServerClient();
  const { data, count } = await supabase
    .from("prospects")
    .select("id, full_name, email, stage, created_at, converted_member_id, sponsor_member_id", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1)
    .returns<ProspectRow[]>();

  const rows = data ?? [];

  const sponsorIds = [...new Set(rows.map((p) => p.sponsor_member_id).filter(Boolean))] as string[];
  const sponsorById = new Map<string, string>();
  if (sponsorIds.length > 0) {
    const { data: sponsors } = await supabase
      .from("members")
      .select("id, username")
      .in("id", sponsorIds)
      .returns<{ id: string; username: string }[]>();
    for (const s of sponsors ?? []) sponsorById.set(s.id, s.username);
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Prospects</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Convert a prospect into a member to activate their upline commissions.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No prospects yet"
          description="Prospects appear here once people register for events."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((p) => (
              <li key={p.id} className="grid gap-3 px-4 py-3 min-[520px]:flex min-[520px]:items-center min-[520px]:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {p.email ?? "—"} · registered {formatEventDateTime(p.created_at)}
                  </p>
                  {p.sponsor_member_id && sponsorById.has(p.sponsor_member_id) ? (
                    <p className="mt-0.5 truncate text-[11px] font-bold text-brand">
                      Invited by @{sponsorById.get(p.sponsor_member_id)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 min-[520px]:shrink-0 min-[520px]:justify-end">
                  <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {p.stage}
                  </span>
                  {p.converted_member_id ? (
                    <span className="text-xs font-black uppercase tracking-wide text-success">
                      Converted
                    </span>
                  ) : (
                    <ConvertProspectButton prospectId={p.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={page} count={count ?? 0} perPage={perPage} hrefFor={pageHref} />
    </div>
  );
}
