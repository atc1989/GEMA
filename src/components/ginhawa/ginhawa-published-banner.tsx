"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unpublishGinhawaLanding } from "@/lib/actions/ginhawa-landing";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatEventDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function GinhawaPublishedBanner({
  eventTitle,
  publishedAt,
  editHref,
  sourceEventId,
  publicHref,
}: {
  eventTitle: string;
  publishedAt: string | null;
  editHref?: string;
  sourceEventId: string;
  publicHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Live landing</p>
          <p className="mt-0.5 text-sm font-bold">{eventTitle}</p>
          {publishedAt ? (
            <p className="text-xs font-semibold text-emerald-800/80">
              Published {formatEventDateTime(publishedAt)}
            </p>
          ) : null}
          {publicHref ? (
            <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-900/70">{publicHref}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {publicHref ? (
            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Open
            </Link>
          ) : null}
          {editHref ? (
            <Link href={editHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Edit
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            Unpublish
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        title="Unpublish landing?"
        description="This event’s public /e page will return 404 until you publish again. Other event landings stay live."
        confirmLabel="Unpublish"
        destructive
        pending={pending}
        error={error}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
            const result = await unpublishGinhawaLanding(sourceEventId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            router.refresh();
          });
        }}
      />
    </>
  );
}
