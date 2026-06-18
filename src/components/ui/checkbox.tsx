import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native styled checkbox. Works with react-hook-form register() and native form
 * submission. Use inside a <label> (or with htmlFor) for an accessible hit area.
 */
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border border-border bg-background text-brand shadow-sm transition-colors outline-none",
        "accent-brand",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
