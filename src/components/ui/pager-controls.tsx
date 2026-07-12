"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PER_PAGE_OPTIONS } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/** Client-side twin of <Pagination> for lists filtered in the browser. */
export function PagerControls({
  page,
  count,
  perPage,
  onPage,
  onPerPage,
}: {
  page: number;
  count: number;
  perPage: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
}) {
  if (count <= PER_PAGE_OPTIONS[0]) return null;
  const totalPages = Math.max(1, Math.ceil(count / perPage));
  const current = Math.min(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide">Show</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {PER_PAGE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onPerPage(n);
                  onPage(1);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
                  n === perPage ? "bg-secondary text-brand" : "hover:bg-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <span>
          Page {current} of {totalPages}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          disabled={current >= totalPages}
          onClick={() => onPage(current + 1)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
