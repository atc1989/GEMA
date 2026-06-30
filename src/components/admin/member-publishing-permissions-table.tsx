"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { updateMemberEventPublishingPermission } from "@/lib/actions/member-permissions";
import { cn } from "@/lib/utils";

export type MemberPublishingPermissionRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  canPublishEvents: boolean;
};

type Feedback =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string }
  | null;

export function MemberPublishingPermissionsTable({
  members,
}: {
  members: MemberPublishingPermissionRow[];
}) {
  const [rows, setRows] = useState(members);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (member: MemberPublishingPermissionRow) => {
    const nextValue = !member.canPublishEvents;
    if (
      nextValue &&
      !window.confirm(`Allow ${member.fullName} to publish events without administrator approval?`)
    ) {
      return;
    }

    setFeedback(null);
    setSavingId(member.id);
    setRows((current) =>
      current.map((row) =>
        row.id === member.id ? { ...row, canPublishEvents: nextValue } : row,
      ),
    );

    startTransition(async () => {
      const result = await updateMemberEventPublishingPermission({
        memberId: member.id,
        canPublishEvents: nextValue,
      });

      if (!result.ok) {
        setRows((current) =>
          current.map((row) =>
            row.id === member.id ? { ...row, canPublishEvents: member.canPublishEvents } : row,
          ),
        );
        setFeedback({ kind: "error", text: result.error });
        setSavingId(null);
        return;
      }

      setRows((current) =>
        current.map((row) =>
          row.id === member.id
            ? { ...row, canPublishEvents: result.data.canPublishEvents }
            : row,
        ),
      );
      setFeedback({
        kind: "success",
        text: `Publishing access ${result.data.canPublishEvents ? "enabled" : "disabled"} for ${result.data.memberName}.`,
      });
      setSavingId(null);
    });
  };

  return (
    <div className="grid gap-3">
      {feedback ? (
        <div
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            feedback.kind === "success"
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/25 bg-destructive/10 text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_120px_190px_120px] gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground md:grid">
          <div>Member</div>
          <div>Email</div>
          <div>Role</div>
          <div>Publishing Access</div>
          <div className="text-right">Self-Publish</div>
        </div>
        <ul className="divide-y divide-border/70">
          {rows.map((member) => {
            const saving = savingId === member.id || (isPending && savingId === member.id);
            return (
              <li
                key={member.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_120px_190px_120px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{member.fullName}</p>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground md:hidden">
                    {member.email}
                  </p>
                </div>
                <div className="hidden min-w-0 truncate text-sm font-semibold text-muted-foreground md:block">
                  {member.email}
                </div>
                <div>
                  <span className="inline-flex rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                    {member.role}
                  </span>
                </div>
                <div className="text-sm font-semibold text-muted-foreground">
                  {member.canPublishEvents ? "Can publish directly" : "Admin approval required"}
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  {saving ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={member.canPublishEvents}
                    aria-label={`Allow ${member.fullName} to publish events without administrator approval`}
                    disabled={saving || (isPending && savingId !== null)}
                    onClick={() => toggle(member)}
                    className={cn(
                      "relative h-7 w-12 rounded-full border border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                      member.canPublishEvents ? "bg-brand" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                        member.canPublishEvents ? "translate-x-5" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
