import { ShieldCheck, Clock } from "lucide-react";

/**
 * Shown on the scanner once the host check-in window has closed (6h after
 * ends_at). Admins still check in; hosts are told the desk is closed.
 */
export function CheckInWindowNotice({
  isAdmin,
  closedForHosts,
}: {
  isAdmin: boolean;
  closedForHosts: boolean;
}) {
  if (!closedForHosts) return null;

  if (isAdmin) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-snug text-amber-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden="true" />
        <p>
          This event has ended. Admin check-in is still allowed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold leading-snug text-muted-foreground">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>This event has already ended. Check-in is closed.</p>
    </div>
  );
}
