import type { LucideIcon } from "lucide-react";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EventCardProps = {
  icon: LucideIcon;
  title: string;
  meta: string;
  venue: string;
  visibility?: "Public" | "Private";
  registered?: number;
  capacity?: number;
  className?: string;
};

export function EventCard({
  icon: Icon,
  title,
  meta,
  venue,
  visibility = "Public",
  registered,
  capacity,
  className,
}: EventCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 text-sm font-bold leading-5">
              {title}
            </h2>
            <span
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-black uppercase",
                visibility === "Public"
                  ? "bg-purple-50 text-purple"
                  : "bg-slate-100 text-muted-foreground"
              )}
            >
              {visibility}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {meta}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {venue}
            </span>
          </div>
          {typeof registered === "number" ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                {registered}
                {capacity ? ` / ${capacity}` : ""} registered
              </span>
              <Button size="sm" variant="soft">
                View
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
