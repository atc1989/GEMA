"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { changePassword, type FieldErrors } from "@/lib/actions/settings";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const applyFieldErrors = (fieldErrors?: FieldErrors) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        setError(name as keyof ChangePasswordInput, { message: messages[0] });
      }
    }
  };

  const onSubmit = handleSubmit((values) => {
    setSuccess(false);
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        setError("root", { message: result.error });
        return;
      }
      reset();
      setSuccess(true);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field
        label="New password"
        htmlFor="newPassword"
        error={errors.newPassword?.message}
        required
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register("newPassword")}
          aria-invalid={!!errors.newPassword}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          aria-invalid={!!errors.confirmPassword}
        />
      </Field>

      {errors.root?.message ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {errors.root.message}
        </p>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
          Password updated — use it next time you sign in.
        </div>
      ) : null}

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
