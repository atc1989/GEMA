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
import { Select } from "@/components/ui/select";
import {
  formatArrivalWindow,
  formatWindowRange,
  isSoldOut,
  slotHasSeats,
  type EventScheduling,
} from "@/lib/events/slots";
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
  scheduling = null,
}: {
  eventId: string;
  refCode?: string;
  /**
   * Arrival slots on a scheduled event. This page is the fallback the landing
   * sheet degrades to, so it has to offer the same windows — without it a guest
   * who lands here can never book a scheduled event at all.
   */
  scheduling?: EventScheduling | null;
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
      consentPrivacy: false,
      consentMarketing: false,
      slotId: "",
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
          {success.slotStartsAt && success.slotEndsAt ? (
            <p className="mt-3 rounded-xl bg-secondary/60 px-4 py-3 text-sm font-bold">
              Arrive{" "}
              {formatWindowRange(
                success.slotStartsAt,
                success.slotEndsAt,
                success.timezone,
              )}
            </p>
          ) : null}
        </Card>

        <QRCodeCard
          value={success.qrToken}
          code={success.passCode}
          title="Your event pass"
          fileName={`GEMA-pass-${success.passCode}`}
          autoSave
          description="We saved this QR to your downloads. Show it at the door for check-in — if it did not save, tap Save QR below."
        />
      </div>
    );
  }

  // No walk-ins: when every window has gone there is nothing to offer, so the
  // form itself comes off the page rather than failing at submit.
  if (scheduling && isSoldOut(scheduling)) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-lg font-black tracking-tight">Fully booked</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Every arrival time for this check-up has gone. Watch for the next date.
        </p>
      </Card>
    );
  }

  const windows = scheduling?.slots.filter(slotHasSeats) ?? [];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" {...register("eventId")} />
      <input type="hidden" {...register("refCode")} />

      <Card className="grid gap-4 p-5">
        {scheduling ? (
          <Field
            label="Arrival time"
            htmlFor="slotId"
            required
            error={errors.slotId?.message}
            hint="Come any time inside your window. You are seen in the order people arrive."
          >
            <Select id="slotId" required defaultValue="" {...register("slotId")}>
              <option value="" disabled>
                Pick a window
              </option>
              {windows.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatArrivalWindow(slot, scheduling.timezone)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
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
        {pending ? "Reserving your seatâ¦" : "Reserve my seat"}
      </Button>
    </form>
  );
}
