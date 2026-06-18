"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, PartyPopper } from "lucide-react";

import { QRCodeCard } from "@/components/qr/qr-code-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  registerProspectForEvent,
  type FieldErrors,
  type RegistrationSuccess,
} from "@/lib/actions/registration";
import {
  prospectRegistrationSchema,
  type ProspectRegistrationInput,
} from "@/lib/schemas/prospect";
import { formatEventDateTime } from "@/lib/utils/format";

export function ProspectRegistrationForm({
  eventId,
  refCode,
}: {
  eventId: string;
  refCode?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProspectRegistrationInput>({
    resolver: zodResolver(prospectRegistrationSchema),
    defaultValues: {
      eventId,
      refCode,
      fullName: "",
      phone: "",
      email: "",
      city: "",
      consentPrivacy: false,
      consentMarketing: false,
    },
  });

  const applyFieldErrors = (fieldErrors?: FieldErrors) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        setError(name as keyof ProspectRegistrationInput, { message: messages[0] });
      }
    }
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await registerProspectForEvent(values);
      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        setError("root", { message: result.error });
        return;
      }
      setSuccess(result.data);
    });
  });

  if (success) {
    return (
      <div className="grid gap-4">
        <Card className="flex flex-col items-center p-6 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-success">
            <PartyPopper className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-black tracking-tight">You&apos;re registered!</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {success.attendeeName}, your seat for{" "}
            <span className="font-bold text-foreground">{success.eventTitle}</span> on{" "}
            {formatEventDateTime(success.startsAt, success.timezone)} is confirmed.
          </p>
        </Card>

        <QRCodeCard
          value={success.qrToken}
          code={success.passCode}
          title="Your event pass"
          description="Show this QR at the door for check-in. Keep your confirmation code handy as a backup."
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" {...register("eventId")} />
      <input type="hidden" {...register("refCode")} />

      <Card className="grid gap-4 p-5">
        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" {...register("fullName")} />
        </Field>
        <Field label="Mobile number" htmlFor="phone" required error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xx xxx xxxx"
            {...register("phone")}
          />
        </Field>
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="City" htmlFor="city" required error={errors.city?.message}>
          <Input id="city" autoComplete="address-level2" {...register("city")} />
        </Field>
      </Card>

      <Card className="grid gap-3 p-5">
        <label className="flex items-start gap-3" htmlFor="consentPrivacy">
          <Checkbox id="consentPrivacy" {...register("consentPrivacy")} />
          <span className="text-sm font-semibold leading-5">
            I agree to the privacy terms and consent to GEMA storing my details for this event.
            <span className="text-destructive"> *</span>
          </span>
        </label>
        {errors.consentPrivacy?.message ? (
          <p className="text-xs font-semibold text-destructive">
            {errors.consentPrivacy.message}
          </p>
        ) : null}

        <label className="flex items-start gap-3" htmlFor="consentMarketing">
          <Checkbox id="consentMarketing" {...register("consentMarketing")} />
          <span className="text-sm font-semibold leading-5 text-muted-foreground">
            Send me updates and invitations to future events (optional).
          </span>
        </label>
      </Card>

      {errors.root?.message ? (
        <p className="text-sm font-semibold text-destructive">{errors.root.message}</p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" disabled={pending}>
        <CheckCircle2 aria-hidden="true" />
        {pending ? "Reserving your seat…" : "Reserve my seat"}
      </Button>
    </form>
  );
}
