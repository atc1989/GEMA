"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Wallet } from "lucide-react";

import { approveAllPending, markAllApprovedPaid } from "@/lib/actions/commissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function BulkCommissionActions({
  pendingCount,
  approvedCount,
}: {
  pendingCount: number;
  approvedCount: number;
}) {
  const [approvePending, startApprove] = useTransition();
  const [markingPaid, startMarkPaid] = useTransition();
  const [confirming, setConfirming] = useState<"approve" | "paid" | null>(null);

  if (pendingCount === 0 && approvedCount === 0) return null;

  const plural = (n: number) => (n === 1 ? "commission" : "commissions");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pendingCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          disabled={approvePending}
          onClick={() => setConfirming("approve")}
        >
          <BadgeCheck className="size-4" aria-hidden="true" />
          {approvePending ? "Approving…" : `Approve all ${pendingCount} pending`}
        </Button>
      ) : null}

      {approvedCount > 0 ? (
        <Button
          size="sm"
          variant="brand"
          disabled={markingPaid}
          onClick={() => setConfirming("paid")}
        >
          <Wallet className="size-4" aria-hidden="true" />
          {markingPaid ? "Marking paid…" : `Mark ${approvedCount} approved as paid`}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirming === "approve"}
        title="Approve all pending commissions?"
        description={`${pendingCount} pending ${plural(pendingCount)} will be approved for payout.`}
        confirmLabel={`Approve all ${pendingCount}`}
        pending={approvePending}
        onConfirm={() =>
          startApprove(async () => {
            await approveAllPending();
            setConfirming(null);
          })
        }
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "paid"}
        title="Mark all approved as paid?"
        description={`${approvedCount} approved ${plural(approvedCount)} will be recorded as paid. Confirm only after the payouts have actually been made.`}
        confirmLabel={`Mark ${approvedCount} paid`}
        pending={markingPaid}
        onConfirm={() =>
          startMarkPaid(async () => {
            await markAllApprovedPaid();
            setConfirming(null);
          })
        }
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
