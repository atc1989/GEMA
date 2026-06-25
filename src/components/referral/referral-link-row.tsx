"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Sparkles } from "lucide-react";

import { createReferralLink } from "@/lib/actions/referrals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

export function ReferralLinkRow({
  eventId,
  eventTitle,
  eventMeta,
  initialRefCode,
}: {
  eventId: string;
  eventTitle: string;
  eventMeta: string;
  initialRefCode: string | null;
}) {
  const [refCode, setRefCode] = useState<string | null>(initialRefCode);
  const [origin, setOrigin] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = refCode ? `${origin}/invite/${eventId}?ref=${refCode}` : "";

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createReferralLink({ eventId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRefCode(result.data.refCode);
    });
  };

  return (
    <Card className="grid gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{eventTitle}</p>
        <p className="truncate text-xs font-semibold text-muted-foreground">{eventMeta}</p>
      </div>

      {refCode ? (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-mono text-xs">
              {shareUrl || `/invite/${eventId}?ref=${refCode}`}
            </span>
          </div>
          <CopyButton value={shareUrl || `/invite/${eventId}?ref=${refCode}`} />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            No referral link yet.
          </span>
          <Button type="button" variant="brand" size="sm" onClick={onCreate} disabled={pending}>
            <Sparkles aria-hidden="true" />
            {pending ? "Creating…" : "Create link"}
          </Button>
        </div>
      )}

      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </Card>
  );
}
