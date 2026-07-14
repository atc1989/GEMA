"use client";

import { useActionState } from "react";

import { requestPasswordResetAction, type ResetRequestResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetRequestResult, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Username or email" htmlFor="identifier" required>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="johndoe or you@example.com"
          required
        />
      </Field>

      {state ? (
        <p
          className={
            state.ok
              ? "rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand"
              : "rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
