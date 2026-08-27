"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, QrCode, Sparkles } from "lucide-react";

import { createReferralLink } from "@/lib/actions/referrals";
import { QrDownload } from "@/components/qr/qr-download";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

/** Prefer published medical landing URL; fall back to classic invite page. */
export function referralSharePath(
  eventId: string,
  refCode: string,
  landingSlug?: string | null,
): string {
  if (landingSlug) return `/e/${landingSlug}?ref=${encodeURIComponent(refCode)}`;
  return `/invite/${eventId}?ref=${encodeURIComponent(refCode)}`;
}

export function ReferralLinkRow({
  eventId,
  eventTitle,
  eventMeta,
  initialRefCode,
  landingSlug = null,
}: {
  eventId: string;
  eventTitle: string;
  eventMeta: string;
  initialRefCode: string | null;
  /** When set, share links go to /e/[slug] instead of /invite. */
  landingSlug?: string | null;
}) {
  const [refCode, setRefCode] = useState<string | null>(initialRefCode);
  const [origin, setOrigin] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = refCode ? referralSharePath(eventId, refCode, landingSlug) : "";
  const shareUrl = path && origin ? `${origin}${path}` : path;

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
        {landingSlug ? (
          <p className="mt-0.5 text-[11px] font-semibold text-brand">Shares landing page</p>
        ) : null}
      </div>

      {refCode ? (
        <div className="grid min-w-0 gap-2 sm:flex sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-mono text-xs">{shareUrl || path}</span>
          </div>
          <div className="flex gap-2 sm:contents">
            <CopyButton value={shareUrl || path} />
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => setShowQr((v) => !v)}
              aria-expanded={showQr}
              className="flex-1 sm:flex-none"
            >
              <QrCode aria-hidden="true" />
              QR
            </Button>
          </div>
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
            {pending ? "Creating…" : "Create link"}
          </Button>
        </div>
      )}

      {refCode && showQr ? (
        <QrDownload path={path} fileName={`referral-${refCode}-qr`} />
      ) : null}

      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </Card>
  );
}
