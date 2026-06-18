"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { createEvent, updateEvent, type FieldErrors } from "@/lib/actions/events";
import { eventFormSchema, type EventFormInput } from "@/lib/schemas/event";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EVENT_TYPES: EventFormInput["eventType"][] = [
  "presentation",
  "business",
  "training",
  "sizzle",
  "mentoring",
  "fellowship",
  "other",
];

type EventFormProps =
  | { mode: "create"; eventId?: undefined; defaultValues?: Partial<EventFormInput> }
  | { mode: "edit"; eventId: string; defaultValues: Partial<EventFormInput> };

export function EventForm({ mode, eventId, defaultValues }: EventFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<EventFormInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      eventType: "presentation",
      visibility: "public",
      mode: "in_person",
      timezone: "Asia/Manila",
      ...defaultValues,
    },
  });

  const selectedMode = watch("mode");
  const showVenue = selectedMode !== "online";
  const showOnline = selectedMode !== "in_person";

  const applyFieldErrors = (fieldErrors?: FieldErrors) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) {
        setError(name as keyof EventFormInput, { message: messages[0] });
      }
    }
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createEvent(values)
          : await updateEvent(eventId, values);

      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        setError("root", { message: result.error });
        return;
      }

      const id = mode === "create" ? result.data.id : eventId;
      router.push(`/admin/events/${id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Card className="grid gap-4 p-5">
        <Field label="Title" htmlFor="title" required error={errors.title?.message}>
          <Input id="title" placeholder="Business Presentation Night" {...register("title")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" htmlFor="eventType" error={errors.eventType?.message}>
            <Select id="eventType" {...register("eventType")}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Visibility" htmlFor="visibility" error={errors.visibility?.message}>
            <Select id="visibility" {...register("visibility")}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </Select>
          </Field>
          <Field label="Mode" htmlFor="mode" error={errors.mode?.message}>
            <Select id="mode" {...register("mode")}>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starts at" htmlFor="startsAt" required error={errors.startsAt?.message}>
            <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
          </Field>
          <Field label="Ends at" htmlFor="endsAt" error={errors.endsAt?.message}>
            <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
          </Field>
          <Field label="Timezone" htmlFor="timezone" error={errors.timezone?.message}>
            <Input id="timezone" {...register("timezone")} />
          </Field>
        </div>
      </Card>

      {showVenue ? (
        <Card className="grid gap-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Venue
          </p>
          <Field label="Venue name" htmlFor="venueName" error={errors.venueName?.message}>
            <Input id="venueName" {...register("venueName")} />
          </Field>
          <Field
            label="Venue address"
            htmlFor="venueAddress"
            error={errors.venueAddress?.message}
          >
            <Input id="venueAddress" {...register("venueAddress")} />
          </Field>
          <Field
            label="Map URL (optional)"
            htmlFor="mapUrl"
            error={errors.mapUrl?.message}
            hint="Optional Google Maps link — leave blank if none."
          >
            <Input
              id="mapUrl"
              type="text"
              inputMode="url"
              placeholder="maps.google.com/…"
              {...register("mapUrl")}
            />
          </Field>
        </Card>
      ) : null}

      {showOnline ? (
        <Card className="grid gap-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Online
          </p>
          <Field label="Online URL" htmlFor="onlineUrl" error={errors.onlineUrl?.message}>
            <Input
              id="onlineUrl"
              type="url"
              placeholder="https://meet.example.com/..."
              {...register("onlineUrl")}
            />
          </Field>
        </Card>
      ) : null}

      <Card className="grid gap-4 p-5">
        <Field
          label="Capacity"
          htmlFor="capacity"
          error={errors.capacity?.message}
          hint="Leave blank for unlimited."
        >
          <Input id="capacity" type="number" min={1} step={1} {...register("capacity")} />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" rows={5} {...register("description")} />
        </Field>
        <Field
          label="Banner URL (optional)"
          htmlFor="bannerUrl"
          error={errors.bannerUrl?.message}
          hint="Optional banner image link — leave blank if none."
        >
          <Input
            id="bannerUrl"
            type="text"
            inputMode="url"
            placeholder="example.com/banner.jpg"
            {...register("bannerUrl")}
          />
        </Field>
      </Card>

      {errors.root?.message ? (
        <p className="text-sm font-semibold text-destructive">{errors.root.message}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create event"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
