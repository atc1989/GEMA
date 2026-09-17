import Link from "next/link";

import { cn } from "@/lib/utils";

export type AttendanceDay = {
  /** "2026-09-11" in the event's timezone. */
  key: string;
  label: string;
  count: number;
};

/**
 * One day of a repeating clinic at a time.
 *
 * A Friday-Saturday check-up is kept as a single event so its landing URL never
 * changes, which means every week's registrations pile into one list. The axis
 * that separates them is the day each guest is *coming* — their arrival window —
 * not the day they registered, which is what a plain date filter would have
 * given and would put a Monday sign-up for Saturday in the wrong bucket.
 *
 * Rendered only when the event actually spans more than one day.
 */
export function AttendanceDayTabs({
  basePath,
  days,
  activeDay,
  totalLabel = "All days",
  total,
}: {
  /** Page path the chips link back to, without a query string. */
  basePath: string;
  days: AttendanceDay[];
  /** null shows everything. */
  activeDay: string | null;
  totalLabel?: string;
  total: number;
}) {
  if (days.length < 2) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Days">
      <Chip href={basePath} active={activeDay === null} label={totalLabel} count={total} />
      {days.map((day) => (
        <Chip
          key={day.key}
          href={`${basePath}?day=${day.key}`}
          active={activeDay === day.key}
          label={day.label}
          count={day.count}
        />
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-xl border-2 px-3 py-2",
        active ? "border-foreground bg-secondary/60" : "border-border bg-background",
      )}
    >
      <span className="block text-sm font-black">{label}</span>
      <span className="block text-[11px] font-semibold text-muted-foreground">
        {count} registered
      </span>
    </Link>
  );
}
