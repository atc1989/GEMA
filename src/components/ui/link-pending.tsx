"use client";

import { useLinkStatus } from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pending indicators for <Link> navigations. Both must be rendered INSIDE a
 * <Link> — useLinkStatus reads that specific link's transition state, so the
 * clicked item (and only it) reacts immediately.
 */

/** Small spinner that appears only while the enclosing link's navigation is pending. */
export function LinkSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

/** Icon that swaps to a spinner while the enclosing link's navigation is pending. */
export function LinkPendingIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
  }
  return <Icon className={className} aria-hidden="true" />;
}
