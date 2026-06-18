"use client";

import { useState, useTransition } from "react";
import { UserCheck } from "lucide-react";

import { convertProspect } from "@/lib/actions/conversion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ConvertProspectButton({ prospectId }: { prospectId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onConvert = () => {
    setError(null);
    startTransition(async () => {
      const result = await convertProspect({ prospectId, basisAmount: basis });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      setOpen(false);
    });
  };

  if (done) {
    return <span className="text-xs font-black uppercase tracking-wide text-success">Converted</span>;
  }

  if (!open) {
    return (
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        <UserCheck aria-hidden="true" />
        Convert
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Basis amount"
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
          inputMode="decimal"
          className="h-7 w-24 text-xs"
        />
        <Button size="xs" variant="brand" disabled={pending} onClick={onConvert}>
          {pending ? "Converting…" : "Confirm"}
        </Button>
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
