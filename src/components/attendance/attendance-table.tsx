import type { LucideIcon } from "lucide-react";

import { RegistrationNoteField } from "@/components/attendance/registration-note-field";
import { RemoveRegistrationButton } from "@/components/attendance/remove-registration-button";
import { Card } from "@/components/ui/card";
import { PaginatedList } from "@/components/ui/paginated-list";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { RegistrationKind } from "@/lib/database/types";

export type AttendanceRow = {
  id: string;
  name: string;
  kind: RegistrationKind;
  email: string | null;
  phone: string | null;
  /** Name of the member whose referral link brought this attendee in. */
  invitedBy: string | null;
  /** The referral code they registered through. */
  refCode: string | null;
  registeredAt: string | null;
  checkedInAt: string | null;
  adminNote?: string | null;
};

type AttendanceTableProps = {
  title: string;
  icon: LucideIcon;
  rows: AttendanceRow[];
  emptyLabel: string;
  variant?: "checked" | "pending";
  eventId: string;
  /** When true, each row also gets a remove button that cancels the registration. */
  removable?: boolean;
  /** When true, each row gets an editable admin-only note field. Admin view only. */
  showNotes?: boolean;
};

export function AttendanceTable({
  title,
  icon: Icon,
  rows,
  emptyLabel,
  variant = "pending",
  eventId,
  removable = false,
  showNotes = false,
}: AttendanceTableProps) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </div>
        <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-black text-brand">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm font-semibold text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <PaginatedList
          className="divide-y divide-border/60"
          pagerClassName="border-t border-border/70 px-4 py-3"
        >
          {rows.map((row) => (
            <li key={row.id} className="grid gap-2 px-4 py-3 min-[520px]:flex min-[520px]:items-center min-[520px]:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black uppercase",
                  variant === "checked"
                    ? "bg-emerald-50 text-success"
                    : "bg-secondary text-brand",
                )}
              >
                {row.name.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{row.name}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {[row.email, row.phone].filter(Boolean).join(" · ") || "—"}
                </p>
                {row.invitedBy ? (
                  <p className="truncate text-[11px] font-semibold text-brand">
                    Invited by {row.invitedBy}
                    {row.refCode ? (
                      <span className="font-mono text-muted-foreground"> · {row.refCode}</span>
                    ) : null}
                  </p>
                ) : null}
                {showNotes ? (
                  <RegistrationNoteField
                    eventId={eventId}
                    registrationId={row.id}
                    initialNote={row.adminNote ?? null}
                  />
                ) : null}
              </div>
              </div>
              <div className="min-[520px]:shrink-0 min-[520px]:text-right">
                <span className="block text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {row.kind}
                </span>
                {variant === "checked" && row.checkedInAt ? (
                  <span className="text-xs font-semibold text-success">
                    {formatEventDateTime(row.checkedInAt)}
                  </span>
                ) : row.registeredAt ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    Reg. {formatEventDateTime(row.registeredAt)}
                  </span>
                ) : null}
              </div>
              {removable ? (
                <div className="min-[520px]:shrink-0">
                <RemoveRegistrationButton
                  eventId={eventId}
                  registrationId={row.id}
                  attendeeName={row.name}
                />
                </div>
              ) : null}
            </li>
          ))}
        </PaginatedList>
      )}
    </Card>
  );
}
