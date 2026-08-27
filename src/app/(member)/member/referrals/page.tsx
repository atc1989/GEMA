import {
  ReferralLinksView,
  type ReferralEventItem,
  type ReferralLinkItem,
} from "@/components/referral/referral-links-view";
import { getCurrentMember } from "@/lib/auth/require-member";
import type { EventType } from "@/lib/database/types";
import { eventTimeOrFilter } from "@/lib/event-time-filter";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  starts_at: string;
  timezone: string;
  event_type: EventType;
};

type ReferralRow = {
  ref_code: string;
  event_id: string | null;
  status: string;
};

type LandingRow = {
  source_event_id: string;
  published: boolean;
  template: string;
};

export default async function MemberReferralsPage() {
  const ctx = await getCurrentMember();
  const member = ctx!.member;

  const supabase = await createSupabaseServerClient();

  const [{ data: events }, { data: referrals }, { data: landings }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, starts_at, timezone, event_type")
      .eq("status", "published")
      .or(eventTimeOrFilter())
      .order("starts_at", { ascending: true })
      .limit(200)
      .returns<EventRow[]>(),
    supabase
      .from("referrals")
      .select("ref_code, event_id, status")
      .eq("referrer_member_id", member.id)
      .returns<ReferralRow[]>(),
    supabase
      .from("ginhawa_landing")
      .select("source_event_id, published, template")
      .eq("published", true)
      .returns<LandingRow[]>(),
  ]);

  const refByEvent = new Map(
    (referrals ?? []).filter((r) => r.event_id).map((r) => [r.event_id as string, r.ref_code]),
  );
  const titleByEvent = new Map((events ?? []).map((e) => [e.id, e.title]));
  const landingSlugByEvent = new Map(
    (landings ?? []).map((l) => {
      const event = (events ?? []).find((e) => e.id === l.source_event_id);
      return [l.source_event_id, event?.slug ?? null] as const;
    }).filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

  const eventItems: ReferralEventItem[] = (events ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    meta: formatEventDateTime(e.starts_at, e.timezone),
    eventType: e.event_type,
    refCode: refByEvent.get(e.id) ?? null,
    landingSlug: landingSlugByEvent.get(e.id) ?? null,
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
          Create a personal link for any published event. Events with a live landing share
          that page first; others still use the invite page. Prospects who register through the
          link are attributed to you.
        </p>
      </div>

      <ReferralLinksView events={eventItems} links={linkItems} />
    </div>
  );
}
