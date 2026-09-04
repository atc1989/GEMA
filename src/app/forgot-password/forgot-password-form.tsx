"use client";

import { useActionState, useState } from "react";

import Link from "next/link";

import { requestPasswordResetAction, type ResetRequestResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetRequestResult, FormData>(
    requestPasswordResetAction,
    undefined,
  );
  const [identifier, setIdentifier] = useState("");

  // The reset email carries a link on some projects and a 6-digit code on
  // others. With a code there is nothing to click, so always offer the way in
  // to the code step. Prefill only what the member typed here — never anything
  // the server said, which would leak whether the address exists.
  const typedEmail = identifier.includes("@") ? identifier.trim() : "";
  const codeStepHref = typedEmail
    ? `/reset-password?email=${encodeURIComponent(typedEmail)}`
    : "/reset-password";

  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Username or email" htmlFor="identifier" required>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="johndoe or you@example.com"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
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
        {pending ? "Sending..." : "Send reset"}
      </Button>

      {state?.ok ? (
        <Link
          href={codeStepHref}
          className="text-center text-sm font-bold text-brand hover:underline"
        >
          Got a 6-digit code instead? Enter it here
        </Link>
      ) : null}
    </form>
  );
}
