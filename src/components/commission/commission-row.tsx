"use client";

import { useState, useTransition } from "react";

import {
  approveCommission,
  markCommissionPaid,
  reverseCommission,
} from "@/lib/actions/commissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export type CommissionStatus = "pending" | "approved" | "paid" | "reversed" | "void";

export type CommissionView = {
  id: string;
  earnerName: string;
  sourceName: string;
  level: number;
  amount: string;
  currency: string;
  status: CommissionStatus;
};

const STATUS_TONE: Record<CommissionStatus, string> = {
  pending: "bg-slate-100 text-muted-foreground",
  approved: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-success",
  reversed: "bg-destructive/10 text-destructive",
  void: "bg-slate-100 text-muted-foreground",
};

export function CommissionRow({
  commission,
  showActions = false,
}: {
  commission: CommissionView;
  showActions?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CommissionStatus>(commission.status);
  const [confirming, setConfirming] = useState<"paid" | "reversed" | null>(null);

  const amountLabel = `${commission.currency === "PHP" ? "₱" : `${commission.currency} `}${commission.amount}`;

  const run = (
    action: (input: { commissionId: string }) => Promise<{ ok: boolean; error?: string }>,
    next: CommissionStatus,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action({ commissionId: commission.id });
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setStatus(next);
      setConfirming(null);
    });
  };

  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{commission.earnerName}</p>
          <p className="truncate text-xs font-semibold text-muted-foreground">
            L{commission.level} · from {commission.sourceName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-black tabular-nums">
            {commission.currency === "PHP" ? "₱" : `${commission.currency} `}
            {commission.amount}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide",
              STATUS_TONE[status],
            )}
          >
            {status}
          </span>
        </div>
      </div>

      {showActions && status !== "reversed" && status !== "void" ? (
        <div className="flex flex-wrap items-center gap-2">
          {status === "pending" ? (
            <Button
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={() => run(approveCommission, "approved")}
            >
              Approve
            </Button>
          ) : null}
          {status === "approved" ? (
            <Button
              size="xs"
              variant="brand"
              disabled={pending}
              onClick={() => setConfirming("paid")}
            >
              Mark paid
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirming("reversed")}
          >
            Reverse
          </Button>
        </div>
      ) : null}

      {error && !confirming ? (
        <p className="text-xs font-semibold text-destructive">{error}</p>
      ) : null}

      <ConfirmDialog
        open={confirming === "paid"}
        title="Mark commission as paid?"
        description={`${amountLabel} to ${commission.earnerName} will be recorded as paid. Confirm only after the payout has actually been made.`}
        confirmLabel="Mark paid"
        pending={pending}
        error={error}
        onConfirm={() => run(markCommissionPaid, "paid")}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "reversed"}
        destructive
        title="Reverse this commission?"
        description={`${amountLabel} for ${commission.earnerName} will be reversed. This cannot be undone from this screen.`}
        confirmLabel="Reverse"
        pending={pending}
        error={error}
        onConfirm={() => run(reverseCommission, "reversed")}
        onClose={() => setConfirming(null)}
      />
    </li>
  );
}
