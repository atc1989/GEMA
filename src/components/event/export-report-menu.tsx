import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Export dropdown built on a native <details> element — no client JS.
 * `href` is a report route; format is selected via query param.
 * CSV downloads directly (content-disposition), PDF opens a print view.
 */
export function ExportReportMenu({ href }: { href: string }) {
  return (
    <details className="relative">
      <summary
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <Download aria-hidden="true" />
        Export
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
        <a
          href={`${href}?format=csv`}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-secondary"
        >
          <FileSpreadsheet className="size-4 text-success" aria-hidden="true" />
          CSV (opens in Excel)
        </a>
        <a
          href={`${href}?format=pdf`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-secondary"
        >
          <FileText className="size-4 text-destructive" aria-hidden="true" />
          PDF (print view)
        </a>
      </div>
    </details>
  );
}
