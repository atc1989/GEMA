"use client";

import { useActionState } from "react";

import { resetPasswordAction, type ResetPasswordResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ code }: { code?: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordResult, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {code ? <input type="hidden" name="code" value={code} /> : null}

      <Field label="New password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>

      {state?.ok === false ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
