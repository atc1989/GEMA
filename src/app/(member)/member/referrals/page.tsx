import {
  ReferralLinksView,
  type ReferralEventItem,
  type ReferralLinkItem,
} from "@/components/referral/referral-links-view";
import { getCurrentMember } from "@/lib/auth/require-member";
import type { EventType } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  event_type: EventType;
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
      .select("id, title, starts_at, timezone, event_type")
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .limit(200)
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

  const eventItems: ReferralEventItem[] = (events ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    meta: formatEventDateTime(e.starts_at, e.timezone),
    eventType: e.event_type,
    refCode: refByEvent.get(e.id) ?? null,
  }));

  // Links whose event isn't in the published list (general links, past events)
  // still show, as plain link rows.
  const publishedIds = new Set((events ?? []).map((e) => e.id));
  const linkItems: ReferralLinkItem[] = (referrals ?? [])
    .filter((r) => !r.event_id || !publishedIds.has(r.event_id))
    .map((r) => ({
      refCode: r.ref_code,
      title: r.event_id ? titleByEvent.get(r.event_id) ?? "Event" : "General link",
      status: r.status,
    }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Share &amp; referrals</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Create a personal link for any published event. Prospects who register through it are
          attributed to you.
        </p>
      </div>

      <ReferralLinksView events={eventItems} links={linkItems} />
    </div>
  );
}
