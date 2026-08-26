"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { publishGinhawaLanding, type FieldErrors } from "@/lib/actions/ginhawa-landing";
import { emptyClinician, initialsFromName } from "@/lib/ginhawa/prefill";
import {
  ginhawaLandingFormSchema,
  type GinhawaLandingFormInput,
} from "@/lib/schemas/ginhawa-landing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function GinhawaLandingForm({
  defaultValues,
  eventTitle,
}: {
  defaultValues: GinhawaLandingFormInput;
  eventTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<GinhawaLandingFormInput>({
    resolver: zodResolver(ginhawaLandingFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "clinicians" });

  const applyFieldErrors = (fieldErrors?: FieldErrors) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        setError(name as keyof GinhawaLandingFormInput, { message: messages[0] });
      }
    }
  };

  const onSubmit = (values: GinhawaLandingFormInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await publishGinhawaLanding(values);
      if (!result.ok) {
        setFormError(result.error);
        applyFieldErrors(result.fieldErrors);
        return;
      }
      router.push("/admin/ginhawa");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <input type="hidden" {...register("sourceEventId")} />

      <Card className="grid gap-4 p-5">
        <div>
          <h2 className="text-sm font-black tracking-tight">Landing copy</h2>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Prefill from {eventTitle}. Edits stay on Ginhawa and do not change the event.
          </p>
        </div>

        <Field label="Title" htmlFor="title" error={errors.title?.message} required hint="A newline becomes a line break on the landing h1.">
          <Textarea id="title" rows={2} {...register("title")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date label" htmlFor="dateLabel" error={errors.dateLabel?.message} required>
            <Input id="dateLabel" {...register("dateLabel")} />
          </Field>
          <Field label="Time label" htmlFor="timeLabel" error={errors.timeLabel?.message} required>
            <Input id="timeLabel" {...register("timeLabel")} />
          </Field>
        </div>

        <Field label="Hero details" htmlFor="heroWhat" error={errors.heroWhat?.message}>
          <Textarea id="heroWhat" rows={3} {...register("heroWhat")} />
        </Field>

        <Field
          label="Book my seat URL"
          htmlFor="bookUrl"
          error={errors.bookUrl?.message}
          hint="Ginhawa hero button opens this link. Prefills to this event's public registration form. Leave blank to hide the button."
        >
          <Input
            id="bookUrl"
            type="text"
            inputMode="url"
            placeholder="https://gema-ivory.vercel.app/register/…"
            {...register("bookUrl")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="E-Points" htmlFor="giftPoints" error={errors.giftPoints?.message} required>
            <Input id="giftPoints" inputMode="numeric" {...register("giftPoints")} />
          </Field>
          <Field label="Worth (₱)" htmlFor="giftPeso" error={errors.giftPeso?.message} required>
            <Input id="giftPeso" inputMode="numeric" {...register("giftPeso")} />
          </Field>
          <Field
            label="Displayed capacity"
            htmlFor="capacity"
            error={errors.capacity?.message}
            hint="Display only. GEMA still enforces the event cap. Leave blank to hide the seat count."
          >
            <Input id="capacity" inputMode="numeric" {...register("capacity")} />
          </Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black tracking-tight">Clinicians</h2>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Up to 4. Credentials markdown supports paragraphs, **bold**, and lists.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= 4}
            onClick={() => {
              const next = emptyClinician();
              append({
                id: next.id,
                name: "",
                suffix: "",
                role: "",
                initials: "",
                photo: "",
                licence: "",
                credentialsMd: "",
              });
            }}
          >
            <Plus aria-hidden="true" />
            Add
          </Button>
        </div>
        {errors.clinicians?.root?.message || errors.clinicians?.message ? (
          <p className="text-xs font-semibold text-destructive">
            {errors.clinicians.root?.message ?? errors.clinicians.message}
          </p>
        ) : null}

        {fields.length === 0 ? (
          <p className="text-sm font-medium text-muted-foreground">No clinicians yet.</p>
        ) : null}

        {fields.map((field, i) => (
          <div key={field.id} className="grid gap-3 rounded-xl border border-border/70 p-4">
            <input type="hidden" {...register(`clinicians.${i}.id`)} />
            <input type="hidden" {...register(`clinicians.${i}.photo`)} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Clinician {i + 1}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor={`clinician-name-${i}`} error={errors.clinicians?.[i]?.name?.message} required>
                <Input
                  id={`clinician-name-${i}`}
                  {...register(`clinicians.${i}.name`, {
                    onBlur: () => {
                      const name = getValues(`clinicians.${i}.name`);
                      if (!getValues(`clinicians.${i}.initials`)?.toString().trim()) {
                        setValue(`clinicians.${i}.initials`, initialsFromName(String(name ?? "")));
                      }
                    },
                  })}
                />
              </Field>
              <Field label="Suffix" htmlFor={`clinician-suffix-${i}`} error={errors.clinicians?.[i]?.suffix?.message} hint="MD, RN, …">
                <Input id={`clinician-suffix-${i}`} {...register(`clinicians.${i}.suffix`)} />
              </Field>
              <Field label="Role" htmlFor={`clinician-role-${i}`} error={errors.clinicians?.[i]?.role?.message}>
                <Input id={`clinician-role-${i}`} {...register(`clinicians.${i}.role`)} />
              </Field>
              <Field label="Initials" htmlFor={`clinician-initials-${i}`} error={errors.clinicians?.[i]?.initials?.message}>
                <Input id={`clinician-initials-${i}`} {...register(`clinicians.${i}.initials`)} />
              </Field>
            </div>
            <Field label="Licence" htmlFor={`clinician-licence-${i}`} error={errors.clinicians?.[i]?.licence?.message} hint="Shown in the footer.">
              <Input id={`clinician-licence-${i}`} {...register(`clinicians.${i}.licence`)} />
            </Field>
            <Field
              label="Credentials (markdown)"
              htmlFor={`clinician-creds-${i}`}
              error={errors.clinicians?.[i]?.credentialsMd?.message}
            >
              <Textarea
                id={`clinician-creds-${i}`}
                rows={5}
                placeholder={"- Doctor of Medicine, …\n- Licensed by the PRC\n\nSees patients here every Saturday."}
                {...register(`clinicians.${i}.credentialsMd`)}
              />
            </Field>
          </div>
        ))}
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="text-sm font-black tracking-tight">Video</h2>
        <Field
          label="Google Drive or video URL"
          htmlFor="videoUrl"
          error={errors.videoUrl?.message}
          hint="Drive share links become an embed. Direct video files play natively."
        >
          <Input id="videoUrl" type="text" inputMode="url" placeholder="https://drive.google.com/file/d/…" {...register("videoUrl")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Length label" htmlFor="videoLength" error={errors.videoLength?.message} hint="Shown on the placeholder, e.g. 1:40">
            <Input id="videoLength" {...register("videoLength")} />
          </Field>
          <Field label="Caption" htmlFor="videoCaption" error={errors.videoCaption?.message}>
            <Input id="videoCaption" {...register("videoCaption")} />
          </Field>
        </div>
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="text-sm font-black tracking-tight">Ask</h2>
        <Field label="Heading" htmlFor="askTitle" error={errors.askTitle?.message}>
          <Input id="askTitle" {...register("askTitle")} />
        </Field>
        <Field label="Body" htmlFor="askBody" error={errors.askBody?.message}>
          <Textarea id="askBody" rows={4} {...register("askBody")} />
        </Field>
        <Field label="Punchline" htmlFor="askHit" error={errors.askHit?.message}>
          <Input id="askHit" {...register("askHit")} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="text-sm font-black tracking-tight">Why the gut</h2>
        <Field label="Heading" htmlFor="gutTitle" error={errors.gutTitle?.message}>
          <Input id="gutTitle" {...register("gutTitle")} />
        </Field>
        <Field label="Body" htmlFor="gutBody" error={errors.gutBody?.message}>
          <Textarea id="gutBody" rows={4} {...register("gutBody")} />
        </Field>
        <Field label="Close" htmlFor="gutClose" error={errors.gutClose?.message}>
          <Input id="gutClose" {...register("gutClose")} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="text-sm font-black tracking-tight">Venue</h2>
        <Field label="Venue name" htmlFor="venueName" error={errors.venueName?.message}>
          <Input id="venueName" {...register("venueName")} />
        </Field>
        <Field label="Address" htmlFor="venueAddress" error={errors.venueAddress?.message}>
          <Input id="venueAddress" {...register("venueAddress")} />
        </Field>
        <Field label="Map URL (optional)" htmlFor="mapUrl" error={errors.mapUrl?.message} hint="Hidden on Ginhawa if blank.">
          <Input id="mapUrl" type="text" inputMode="url" {...register("mapUrl")} />
        </Field>
      </Card>

      {formError ? <p className="text-sm font-semibold text-destructive">{formError}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Publish to Ginhawa
        </Button>
      </div>
    </form>
  );
}
