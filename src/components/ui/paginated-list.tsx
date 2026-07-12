"use client";

import { Children, useState, type ReactNode } from "react";

import { PagerControls } from "@/components/ui/pager-controls";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/components/ui/pagination";

/**
 * Client-side pagination over server-rendered list items: pass the items as
 * children and this slices the current page, so server pages don't need to
 * become client components to paginate.
 */
export function PaginatedList({
  as: Tag = "ul",
  className,
  pagerClassName,
  children,
}: {
  as?: "ul" | "div";
  className?: string;
  /** Wrapper class for the pager row (e.g. padding when inside a Card). */
  pagerClassName?: string;
  children: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const items = Children.toArray(children);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visible = items.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <>
      <Tag className={className}>{visible}</Tag>
      {items.length > PER_PAGE_OPTIONS[0] ? (
        <div className={pagerClassName}>
          <PagerControls
            page={safePage}
            count={items.length}
            perPage={perPage}
            onPage={setPage}
            onPerPage={setPerPage}
          />
        </div>
      ) : null}
    </>
  );
}
