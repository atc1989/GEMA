import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PER_PAGE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PER_PAGE = 20;

export function cleanPage(raw?: string) {
  const page = Number(raw ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function cleanPerPage(raw?: string) {
  const per = Number(raw ?? String(DEFAULT_PER_PAGE));
  return (PER_PAGE_OPTIONS as readonly number[]).includes(per) ? per : DEFAULT_PER_PAGE;
}

/** Server-side pager: pages are links, state lives in the URL. */
export function Pagination({
  page,
  count,
  perPage,
  hrefFor,
}: {
  page: number;
  count: number;
  perPage: number;
  hrefFor: (page: number, perPage: number) => string;
}) {
  if (count <= PER_PAGE_OPTIONS[0]) return null;
  const totalPages = Math.max(1, Math.ceil(count / perPage));
  const current = Math.min(page, totalPages);

  return (
    <div className="grid gap-3 text-sm font-semibold text-muted-foreground min-[520px]:flex min-[520px]:items-center min-[520px]:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide">Show</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {PER_PAGE_OPTIONS.map((n) => (
              <Link
                key={n}
                href={hrefFor(1, n)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
                  n === perPage ? "bg-secondary text-brand" : "hover:bg-muted",
                )}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
        <span>
          Page {current} of {totalPages}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[420px]:flex">
        <Link
          href={hrefFor(Math.max(1, current - 1), perPage)}
          aria-disabled={current <= 1}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            current <= 1 && "pointer-events-none opacity-50",
          )}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, current + 1), perPage)}
          aria-disabled={current >= totalPages}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            current >= totalPages && "pointer-events-none opacity-50",
          )}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
