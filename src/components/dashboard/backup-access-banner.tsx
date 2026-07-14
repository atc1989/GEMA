"use client";

import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";

/** Shown after a login that used the local backup credentials (external API down). */
export function BackupAccessBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
      <p className="flex-1">
        You&apos;re logged in using backup access. Some profile info may not be up to date.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="rounded-md p-0.5 text-muted-foreground hover:bg-secondary"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
