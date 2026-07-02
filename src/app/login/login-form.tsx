"use client";

import { useActionState } from "react";

import { loginAction, type LoginResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState<LoginResult, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {state?.ok === false ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
