"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Sparkles } from "lucide-react";

import { createPassReferralLink } from "@/lib/actions/lead-referrals";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * Referral link for a lead, shown on /passes alongside their QR passes. The
 * name/query pair is the same one that found the passes — the action re-checks
 * it server-side.
 */
export function LeadReferralCard({
  initialRefCode,
  name,
  query,
}: {
  initialRefCode: string | null;
  name: string;
  query: string;
}) {
  const [refCode, setRefCode] = useState(initialRefCode);
  const [origin, setOrigin] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = refCode ? `${origin}/invite?ref=${refCode}` : "";

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createPassReferralLink({ name, query });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRefCode(result.data.refCode);
    });
  };

  return (
    <div className="grid gap-3">
      {refCode ? (
        <div className="grid min-w-0 gap-2 sm:flex sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-mono text-xs">
              {shareUrl || `/invite?ref=${refCode}`}
            </span>
          </div>
          <CopyButton value={shareUrl || `/invite?ref=${refCode}`} />
        </div>
      ) : (
        <div className="grid gap-2 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            No referral link yet.
          </span>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={onCreate}
            disabled={pending}
            className="w-full min-[420px]:w-auto"
          >
            <Sparkles aria-hidden="true" />
            {pending ? "Creating…" : "Get my link"}
          </Button>
        </div>
      )}

      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
