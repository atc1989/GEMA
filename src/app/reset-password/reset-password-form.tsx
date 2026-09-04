"use client";

import { useActionState } from "react";

import { resetPasswordAction, type ResetPasswordResult } from "@/lib/actions/auth";
import { EMAIL_CODE_HINT, EMAIL_CODE_LENGTH } from "@/lib/one-account/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * A reset arrives either as a link (`?code=` in the URL) or as a 6-digit code
 * in the email body, depending on the project's Reset Password template. With
 * a link there is nothing to type. Without one, ask for the address and the
 * code rather than leaving the member on a form that cannot succeed.
 */
export function ResetPasswordForm({ code, email }: { code?: string; email?: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordResult, FormData>(
    resetPasswordAction,
    undefined,
  );
  const fromLink = Boolean(code);

  return (
    <form action={formAction} className="grid gap-4">
      {fromLink ? <input type="hidden" name="code" value={code} /> : null}

      {fromLink ? null : (
        <>
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              required
            />
          </Field>

          <Field label={`${EMAIL_CODE_LENGTH}-digit code`} htmlFor="code" required>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={EMAIL_CODE_LENGTH}
              required
            />
            <p className="text-sm text-muted-foreground">{EMAIL_CODE_HINT}</p>
          </Field>
        </>
      )}

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
