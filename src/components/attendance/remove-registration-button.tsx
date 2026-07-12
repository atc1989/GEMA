"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { cancelRegistration } from "@/lib/actions/attendance";
import { cn } from "@/lib/utils";

/** Trash button on a pending attendance row: confirm, then soft-cancel the registration. */
export function RemoveRegistrationButton({
  eventId,
  registrationId,
  attendeeName,
}: {
  eventId: string;
  registrationId: string;
  attendeeName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRemove = () => {
    if (
      !window.confirm(
        `Remove ${attendeeName}'s registration? Their QR pass will stop working.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration({ eventId, registrationId });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={pending}
      aria-label={`Remove ${attendeeName}'s registration`}
      title={error ?? "Remove registration"}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50",
        error && "text-destructive",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
