"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";

import { setMemberPassword } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

export function SetPasswordButton({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await setMemberPassword({ memberId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreds(result.data);
    });
  };

  if (creds) {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <span className="text-xs font-semibold">{creds.email}</span>
        <div className="flex items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold">
            {creds.password}
          </code>
          <CopyButton value={creds.password} />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          Temporary — sign in, then change it at{" "}
          <span className="font-mono">/member/settings</span>.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="xs" variant="outline" onClick={onClick} disabled={pending}>
        <KeyRound aria-hidden="true" />
        {pending ? "Setting…" : "Set password"}
      </Button>
      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}
