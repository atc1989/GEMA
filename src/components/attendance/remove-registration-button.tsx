"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { cancelRegistration } from "@/lib/actions/attendance";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration({ eventId, registrationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${attendeeName}'s registration`}
        title="Remove registration"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={open}
        destructive
        title="Remove registration?"
        description={`${attendeeName}'s registration will be cancelled and their QR pass will stop working.`}
        confirmLabel="Remove"
        pending={pending}
        error={error}
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
