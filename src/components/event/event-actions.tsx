"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, XCircle } from "lucide-react";

import { cancelEvent, publishEvent } from "@/lib/actions/events";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/database/types";

export function EventActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const canEdit = status !== "cancelled";
  const canPublish = status === "draft";
  const canCancel = status === "draft" || status === "published";

  const onPublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishEvent(eventId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onCancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelEvent(eventId, { reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCancelling(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <Link
            href={`/admin/events/${eventId}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Link>
        ) : null}

        {canPublish ? (
          <Button variant="brand" onClick={onPublish} disabled={pending}>
            <CheckCircle2 aria-hidden="true" />
            Publish
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            variant="destructive"
            onClick={() => setCancelling((v) => !v)}
            disabled={pending}
          >
            <XCircle aria-hidden="true" />
            Cancel event
          </Button>
        ) : null}
      </div>

      {cancelling ? (
        <div className="grid gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <Field
            label="Cancellation reason"
            htmlFor="cancel-reason"
            required
            hint="Shared in the cancellation record and registrant notifications."
          >
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Venue unavailable, rescheduling, etc."
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelling(false)}
              disabled={pending}
            >
              Keep event
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onCancel}
              disabled={pending || reason.trim().length < 3}
            >
              Confirm cancellation
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-semibold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
