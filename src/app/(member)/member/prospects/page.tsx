import { Mail, Phone, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  created_at: string;
};

export default async function MemberProspectsPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, full_name, email, phone, stage, created_at")
    .eq("sponsor_member_id", member.id)
    .order("created_at", { ascending: false })
    .returns<ProspectRow[]>();

  const rows = prospects ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">My prospects</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          People who registered through your referral links.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No prospects yet"
          description="Share a referral link to an event. Anyone who registers through it appears here, attributed to you."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <div className="mt-1 grid gap-0.5 text-xs font-semibold text-muted-foreground">
                    {p.email ? (
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5" aria-hidden="true" />
                        {p.email}
                      </span>
                    ) : null}
                    {p.phone ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5" aria-hidden="true" />
                        {p.phone}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    Registered {formatEventDateTime(p.created_at)}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                  {p.stage}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
