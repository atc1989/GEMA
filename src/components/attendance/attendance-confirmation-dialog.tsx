"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { AttendeePreview } from "@/lib/actions/attendance";

export type ConfirmPhase = "review" | "saving" | "success" | "already" | "error";

type Props = {
  open: boolean;
  preview: AttendeePreview | null;
  phase: ConfirmPhase;
  message?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function AttendanceConfirmationDialog({
  open,
  preview,
  phase,
  message,
  onConfirm,
  onClose,
}: Props) {
  if (!open || !preview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm attendance"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight">
            {phase === "success"
              ? "Checked in"
              : phase === "already"
                ? "Already checked in"
                : "Confirm attendance"}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl",
              phase === "success"
                ? "bg-emerald-100 text-success"
                : phase === "already"
                  ? "bg-amber-100 text-gold"
                  : phase === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-brand",
            )}
          >
            {phase === "success" ? (
              <CheckCircle2 className="size-6" aria-hidden="true" />
            ) : phase === "already" ? (
              <Clock className="size-6" aria-hidden="true" />
            ) : phase === "error" ? (
              <AlertCircle className="size-6" aria-hidden="true" />
            ) : (
              <UserCheck className="size-6" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{preview.attendeeName}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {preview.kind}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 text-sm font-semibold text-muted-foreground">
          {preview.attendeeEmail ? (
            <span className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden="true" />
              {preview.attendeeEmail}
            </span>
          ) : null}
          {preview.attendeePhone ? (
            <span className="flex items-center gap-2">
              <Phone className="size-4" aria-hidden="true" />
              {preview.attendeePhone}
            </span>
          ) : null}
          {preview.checkedInAt ? (
            <span className="flex items-center gap-2 text-gold">
              <Clock className="size-4" aria-hidden="true" />
              Checked in {formatEventDateTime(preview.checkedInAt)}
            </span>
          ) : null}
        </div>

        {message ? (
          <p
            className={cn(
              "mt-3 text-sm font-semibold",
              phase === "error" ? "text-destructive" : "text-success",
            )}
          >
            {message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          {phase === "review" || phase === "saving" ? (
            <>
              <Button
                variant="brand"
                size="lg"
                onClick={onConfirm}
                disabled={phase === "saving" || preview.alreadyCheckedIn}
              >
                <CheckCircle2 aria-hidden="true" />
                {phase === "saving" ? "Saving…" : "Confirm check-in"}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={phase === "saving"}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="brand" size="lg" onClick={onClose}>
              Scan next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
