import { Flame } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PaginatedList } from "@/components/ui/paginated-list";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/calendar/no-zero-month";

export function TeamLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  const topStreak = entries[0]!.streak;

  return (
    <Card className="p-4">
      <div className="mb-3 grid gap-1 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between">
        <h3 className="font-heading text-sm font-bold tracking-tight">
          Team No-Zero Leaderboard
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">This week</span>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary/50 p-3 text-xs font-semibold leading-snug text-muted-foreground">
        <Flame className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <div>
          Top streak in your team: <b className="text-foreground">{topStreak} days</b> — keep the
          chain alive together.
        </div>
      </div>

      <PaginatedList className="grid gap-1.5" pagerClassName="mt-3">
        {entries.map((e, i) => (
          <li
            key={e.memberId}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2.5 py-2",
              e.isYou ? "bg-secondary" : "bg-transparent",
            )}
          >
            <span className="w-5 text-center font-heading text-sm font-extrabold text-muted-foreground">
              {i + 1}
            </span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-heading text-xs font-extrabold uppercase text-white">
              {e.username.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              @{e.username}
              {e.isYou ? (
                <span className="ml-1.5 rounded bg-brand px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                  You
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-gold-dark">
              <Flame className="size-3.5 text-gold" aria-hidden="true" />
              {e.streak}d
            </span>
          </li>
        ))}
      </PaginatedList>
    </Card>
  );
}
