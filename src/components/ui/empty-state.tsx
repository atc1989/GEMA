import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center px-6 py-8 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-brand">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {actionLabel ? (
        <Button className="mt-5" variant="brand">
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
