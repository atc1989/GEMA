import { Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InviterRow = {
  name: string;
  membersInvited: number;
  prospectsInvited: number;
  /** How many of their invitees have checked in. */
  checkedIn: number;
};

/**
 * Per-event recruiting leaderboard: who brought people in, ranked by total
 * invited. Built from data the attendance pages already fetch.
 */
export function InviterLeaderboard({ rows }: { rows: InviterRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm font-bold">
        <Trophy className="size-4 text-gold-dark" aria-hidden="true" />
        Top inviters
      </div>
      <ul className="divide-y divide-border/60">
        {rows.map((row, index) => {
          const total = row.membersInvited + row.prospectsInvited;
          return (
            <li key={row.name} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                  index === 0 ? "bg-amber-50 text-gold-dark" : "bg-secondary text-brand",
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{row.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {row.membersInvited} member{row.membersInvited === 1 ? "" : "s"} ·{" "}
                  {row.prospectsInvited} prospect{row.prospectsInvited === 1 ? "" : "s"} ·{" "}
                  {row.checkedIn} checked in
                </p>
              </div>
              <span className="shrink-0 font-heading text-lg font-black text-brand">
                {total}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
