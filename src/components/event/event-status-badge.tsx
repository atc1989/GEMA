import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

const STATUS_STYLES: Record<EventStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-muted-foreground" },
  published: { label: "Published", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  completed: { label: "Completed", className: "bg-purple-50 text-purple" },
  archived: { label: "Archived", className: "bg-slate-100 text-muted-foreground" },
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  const { label, className: tone } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
