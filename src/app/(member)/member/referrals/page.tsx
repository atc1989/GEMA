import { CalendarX, Link2 } from "lucide-react";

import { ReferralLinkRow } from "@/components/referral/referral-link-row";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentMember } from "@/lib/auth/require-member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
};

type ReferralRow = {
  ref_code: string;
  event_id: string | null;
  status: string;
};

export default async function MemberReferralsPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();

  const [{ data: events }, { data: referrals }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, timezone")
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .limit(50)
      .returns<EventRow[]>(),
    supabase
      .from("referrals")
      .select("ref_code, event_id, status")
      .eq("referrer_member_id", member.id)
      .returns<ReferralRow[]>(),
  ]);

  const refByEvent = new Map(
    (referrals ?? []).filter((r) => r.event_id).map((r) => [r.event_id as string, r.ref_code]),
  );
  const titleByEvent = new Map((events ?? []).map((e) => [e.id, e.title]));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Share &amp; referrals</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Create a personal link for any published event. Prospects who register through it are
          attributed to you.
        </p>
      </div>

      <section className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Published events
        </p>
        {(events ?? []).length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="No published events"
            description="Once an organizer publishes an event, you can generate a referral link for it here."
          />
        ) : (
          (events ?? []).map((e) => (
            <ReferralLinkRow
              key={e.id}
              eventId={e.id}
              eventTitle={e.title}
              eventMeta={formatEventDateTime(e.starts_at, e.timezone)}
              initialRefCode={refByEvent.get(e.id) ?? null}
            />
          ))
        )}
      </section>

      {(referrals ?? []).length > 0 ? (
        <section className="grid gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            All my links
          </p>
          <Card className="p-0">
            <ul className="divide-y divide-border/60">
              {(referrals ?? []).map((r) => (
                <li
                  key={r.ref_code}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {r.event_id ? titleByEvent.get(r.event_id) ?? "Event" : "General link"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{r.ref_code}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
