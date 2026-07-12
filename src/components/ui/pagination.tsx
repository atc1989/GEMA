import Link from "next/link";

import { cn } from "@/lib/utils";

export function cleanPage(raw?: string) {
  const page = Number(raw ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted",
            page <= 1 && "pointer-events-none opacity-50",
          )}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted",
            page >= totalPages && "pointer-events-none opacity-50",
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
