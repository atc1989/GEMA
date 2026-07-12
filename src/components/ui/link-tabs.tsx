import Link from "next/link";

import { LinkSpinner } from "@/components/ui/link-pending";
import { cn } from "@/lib/utils";

export type LinkTab = { key: string; label: string; href: string };

/**
 * Segmented, link-based tab bar. Tabs share the row equally when the
 * container is full width and shrink to content when it isn't. Scrolls
 * horizontally instead of wrapping when space runs out.
 */
export function LinkTabs({
  tabs,
  activeKey,
  className,
}: {
  tabs: LinkTab[];
  activeKey: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-[11px] font-black transition-colors sm:text-xs",
              active
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {tab.label}
            <LinkSpinner className="size-3" />
          </Link>
        );
      })}
    </div>
  );
}
