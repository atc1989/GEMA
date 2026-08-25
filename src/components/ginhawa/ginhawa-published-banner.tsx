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
}: {
  eventTitle: string;
  publishedAt: string | null;
  editHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Live on Ginhawa</p>
          <p className="mt-0.5 text-sm font-bold">{eventTitle}</p>
          {publishedAt ? (
            <p className="text-xs font-semibold text-emerald-800/80">
              Published {formatEventDateTime(publishedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
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
        title="Unpublish Ginhawa?"
        description="The public landing will show that no event is scheduled until you publish again."
        confirmLabel="Unpublish"
        destructive
        pending={pending}
        error={error}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() => {
          startTransition(async () => {
            const result = await unpublishGinhawaLanding();
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
