"use client";

import { useEffect, type ReactNode } from "react";
import { CircleHelp, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red icon + red confirm button for destructive/irreversible actions. */
  destructive?: boolean;
  /** Disables both buttons and shows a busy label while the action runs. */
  pending?: boolean;
  /** Shown inside the dialog so failures don't get lost behind it. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Shared confirmation modal: bottom sheet on mobile, centered card on sm+.
 * Escape or overlay click cancels (unless pending).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={pending ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl",
              destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-brand",
            )}
          >
            {destructive ? (
              <TriangleAlert className="size-5" aria-hidden="true" />
            ) : (
              <CircleHelp className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={onClose} disabled={pending} autoFocus>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "brand"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
