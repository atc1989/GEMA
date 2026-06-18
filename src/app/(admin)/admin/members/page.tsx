import { IdCard } from "lucide-react";

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

export default async function AdminMembersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, username, member_code, status, profile_id")
    .order("created_at", { ascending: false })
    .returns<MemberRow[]>();

  const rows = members ?? [];

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
          Set a temporary login password to sign in as a member (e.g. a converted prospect) and
          review their earnings.
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
            {rows.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">@{m.username}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {emailById.get(m.profile_id) ?? "—"} · {m.member_code}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {m.status}
                  </span>
                  <SetPasswordButton memberId={m.id} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
