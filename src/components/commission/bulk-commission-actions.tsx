"use client";

import { useTransition } from "react";
import { BadgeCheck, Wallet } from "lucide-react";

import { approveAllPending, markAllApprovedPaid } from "@/lib/actions/commissions";
import { Button } from "@/components/ui/button";

export function BulkCommissionActions({
  pendingCount,
  approvedCount,
}: {
  pendingCount: number;
  approvedCount: number;
}) {
  const [approvePending, startApprove] = useTransition();
  const [markingPaid, startMarkPaid] = useTransition();

  if (pendingCount === 0 && approvedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pendingCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          disabled={approvePending}
          onClick={() => startApprove(async () => { await approveAllPending(); })}
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
          onClick={() => startMarkPaid(async () => { await markAllApprovedPaid(); })}
        >
          <Wallet className="size-4" aria-hidden="true" />
          {markingPaid ? "Marking paid…" : `Mark ${approvedCount} approved as paid`}
        </Button>
      ) : null}
    </div>
  );
}
