"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { createMemberEvent, updateMemberEvent } from "@/lib/actions/member-events";
import { eventFormSchema, type EventFormInput } from "@/lib/schemas/event";
import { EventPoster, DownloadBannerButton, type EventPosterData } from "@/components/event/event-poster";
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

type MemberEventFormProps =
  | { mode: "create"; eventId?: undefined; defaultValues?: Partial<EventFormInput> }
  | { mode: "edit"; eventId: string; defaultValues: Partial<EventFormInput> };

export function MemberEventForm({ mode, eventId, defaultValues }: MemberEventFormProps) {
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

  const selectedMode = watch("mode") as EventFormInput["mode"];
  const showVenue  = selectedMode !== "online";
  const showOnline = selectedMode !== "in_person";

  // Live poster data derived from form state
  const posterData: EventPosterData = {
    title:       watch("title") || "",
    eventType:   watch("eventType"),
    mode:        selectedMode ?? "in_person",
    startsAt:    watch("startsAt"),
    venueName:   watch("venueName"),
    speakerName: watch("speakerName"),
  };

  const applyFieldErrors = (fieldErrors?: Record<string, string[] | undefined>) => {
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
          ? await createMemberEvent(values)
          : await updateMemberEvent(eventId, values);

      if (!result.ok) {
        applyFieldErrors(result.fieldErrors);
        setError("root", { message: result.error });
        return;
      }

      router.push("/member/events?tab=hosting");
      router.refresh();
    });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Form */}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Card className="grid gap-4 p-5">
          <Field label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" placeholder="Saturday Sizzle" {...register("title")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="eventType" error={errors.eventType?.message}>
              <Select id="eventType" {...register("eventType")}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Visibility" htmlFor="visibility" error={errors.visibility?.message}>
              <Select id="visibility" {...register("visibility")}>
                <option value="public">Public</option>
                <option value="private">Private (invite-only)</option>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at" htmlFor="startsAt" required error={errors.startsAt?.message}>
              <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
            </Field>
            <Field label="Ends at" htmlFor="endsAt" error={errors.endsAt?.message}>
              <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
            </Field>
          </div>
        </Card>

        {showVenue ? (
          <Card className="grid gap-4 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Venue</p>
            <Field label="Venue name" htmlFor="venueName" error={errors.venueName?.message}>
              <Input id="venueName" placeholder="Davao Hub Center" {...register("venueName")} />
            </Field>
            <Field label="Venue address" htmlFor="venueAddress" error={errors.venueAddress?.message}>
              <Input id="venueAddress" {...register("venueAddress")} />
            </Field>
            <Field label="Map URL (optional)" htmlFor="mapUrl" error={errors.mapUrl?.message}>
              <Input id="mapUrl" type="text" inputMode="url" placeholder="maps.google.com/…" {...register("mapUrl")} />
            </Field>
          </Card>
        ) : null}

        {showOnline ? (
          <Card className="grid gap-4 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Online</p>
            <Field label="Online URL" htmlFor="onlineUrl" error={errors.onlineUrl?.message}>
              <Input id="onlineUrl" type="url" placeholder="https://zoom.us/j/…" {...register("onlineUrl")} />
            </Field>
          </Card>
        ) : null}

        <Card className="grid gap-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Details &amp; Banner</p>
          <Field label="Speaker / Host name (optional)" htmlFor="speakerName" error={errors.speakerName?.message}
            hint="Appears on the event banner.">
            <Input id="speakerName" placeholder="e.g. Dr. Joey Sinchioco" {...register("speakerName")} />
          </Field>
          <Field label="Capacity" htmlFor="capacity" error={errors.capacity?.message} hint="Leave blank for unlimited.">
            <Input id="capacity" type="number" min={1} step={1} {...register("capacity")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={4} placeholder="What will attendees learn or experience?" {...register("description")} />
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
            {pending ? "Saving…" : mode === "create" ? "Create event" : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Live banner preview */}
      <div className="flex flex-col gap-4">
        <div className="lg:sticky lg:top-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Live banner preview
          </p>
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <EventPoster data={posterData} />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            Downloads as a 1080 × 1350 PNG ready to share.
          </p>
          <div className="mt-3">
            <DownloadBannerButton data={posterData} label="Download preview banner" />
          </div>
        </div>
      </div>
    </div>
  );
}
