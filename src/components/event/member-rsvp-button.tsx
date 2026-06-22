"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rsvpMemberToEvent } from "@/lib/actions/registration";

export function MemberRsvpButton({
  eventId,
  disabled,
  disabledLabel,
}: {
  eventId: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await rsvpMemberToEvent(eventId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/member/events/${eventId}`);
            router.refresh();
          });
        }}
      >
        <Ticket aria-hidden="true" />
        {pending ? "Saving..." : disabled ? disabledLabel ?? "Unavailable" : "RSVP"}
      </Button>
      {error ? <p className="text-[11px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
