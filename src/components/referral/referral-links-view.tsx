"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";

import { EventFilterBar, matchesSearch } from "@/components/event/event-filter-bar";
import { ReferralLinkRow } from "@/components/referral/referral-link-row";
import { Card } from "@/components/ui/card";
import { PagerControls } from "@/components/ui/pager-controls";
import { DEFAULT_PER_PAGE } from "@/components/ui/pagination";
import type { EventType } from "@/lib/database/types";

export type ReferralEventItem = {
  id: string;
  title: string;
  meta: string;
  eventType: EventType;
  refCode: string | null;
};

/** A referral link that has no published-event row of its own (general or old-event links). */
export type ReferralLinkItem = {
  refCode: string;
  title: string;
  status: string;
};

type Row =
  | { kind: "event"; key: string; title: string; refCode: string | null; event: ReferralEventItem }
  | { kind: "link"; key: string; title: string; refCode: string; link: ReferralLinkItem };

/**
 * One searchable, filterable, paginated list of published events (with their
 * referral-link controls) plus the member's other links.
 */
export function ReferralLinksView({
  events,
  links,
}: {
  events: ReferralEventItem[];
  links: ReferralLinkItem[];
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const rows = useMemo<Row[]>(
    () => [
      ...events.map((event) => ({
        kind: "event" as const,
        key: `event-${event.id}`,
        title: event.title,
        refCode: event.refCode,
        event,
      })),
      ...links.map((link) => ({
        kind: "link" as const,
        key: `link-${link.refCode}`,
        title: link.title,
        refCode: link.refCode,
        link,
      })),
    ],
    [events, links],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (!matchesSearch(q, row.title, row.refCode)) return false;
        if (!type) return true;
        if (type === "published") return row.kind === "event";
        return row.kind === "event" && row.event.eventType === type;
      }),
    [rows, q, type],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="grid gap-3">
      <EventFilterBar
        q={q}
        onQ={setQ}
        type={type}
        onType={setType}
        extraOptions={[{ value: "published", label: "Published events" }]}
        placeholder="Search events or link codes"
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          No events or links match your search or category.
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((row) =>
            row.kind === "event" ? (
              <ReferralLinkRow
                key={row.key}
                eventId={row.event.id}
                eventTitle={row.event.title}
                eventMeta={row.event.meta}
                initialRefCode={row.event.refCode}
              />
            ) : (
              <Card key={row.key} className="grid gap-3 p-4 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.title}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{row.refCode}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                  {row.link.status}
                </span>
              </Card>
            ),
          )}
        </div>
      )}

      <PagerControls
        page={safePage}
        count={filtered.length}
        perPage={perPage}
        onPage={setPage}
        onPerPage={setPerPage}
      />
    </div>
  );
}
