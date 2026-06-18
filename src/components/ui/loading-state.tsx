import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export function LoadingState({
  label = "Loading",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/70 text-sm font-semibold text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="size-8 animate-spin rounded-full border-3 border-secondary border-t-brand" />
      <span>{label}</span>
    </div>
  );
}
