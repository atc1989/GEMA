"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Check, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { createEvent, updateEvent, type FieldErrors } from "@/lib/actions/events";
import { BannerStudio } from "@/components/event/banner-studio";
import { MedicalLandingFields } from "@/components/event/medical-landing-fields";
import { ADMIN_POSTER_FALLBACKS, livePosterData } from "@/components/event/live-poster-data";
import { PhotoAdjuster } from "@/components/event/posters/photo-adjuster";
import { asPhotoFocus, type PhotoFocus } from "@/components/event/posters/shared";
import { asPosterTemplateId, type PosterTemplateId } from "@/components/event/posters/types";
import {
  defaultEventLandingFields,
  eventFormSchema,
  type EventFormInput,
} from "@/lib/schemas/event";
import { uploadEventPhoto } from "@/lib/storage/event-photos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  const [template, setTemplate] = useState<PosterTemplateId>(
    asPosterTemplateId(defaultValues?.posterTemplate),
  );
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(
    typeof defaultValues?.speakerPhotoUrl === "string" ? defaultValues.speakerPhotoUrl : undefined,
  );
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(
    typeof defaultValues?.bannerUrl === "string" ? defaultValues.bannerUrl : undefined,
  );
  const [focus, setFocus] = useState<PhotoFocus>(asPhotoFocus(defaultValues?.photoFocus));
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setError,
    setValue,
    getValues,
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
      landing: defaultEventLandingFields(defaultValues?.landing),
    },
  });

  const selectedMode = watch("mode") ?? "in_person";
  const showVenue = selectedMode !== "online";
  const showOnline = selectedMode !== "in_person";
  const titleWatch = useWatch({ control, name: "title" });
  const typeWatch = useWatch({ control, name: "eventType" });
  const startsWatch = useWatch({ control, name: "startsAt" });
  const venueWatch = useWatch({ control, name: "venueName" });
  const addressWatch = useWatch({ control, name: "venueAddress" });
  const speakerWatch = useWatch({ control, name: "speakerName" });
  const posterData = livePosterData({
    title: titleWatch,
    eventType: typeWatch,
    mode: selectedMode,
    startsAt: startsWatch,
    venueName: venueWatch,
    venueAddress: addressWatch,
    speakerName: speakerWatch,
    speakerPhotoUrl: photoUrl,
    photoFocus: focus,
    fallbackTitle: ADMIN_POSTER_FALLBACKS.title,
    fallbackVenue: ADMIN_POSTER_FALLBACKS.venueName,
  });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadEventPhoto(file, "speakers");
      if (result.ok) setPhotoUrl(result.url);
      else setPhotoError(result.error);
    } finally {
      setUploading(false);
    }
  };

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
      const payload = {
        ...values,
        posterTemplate: template,
        speakerPhotoUrl: photoUrl,
        photoFocus: focus,
        bannerUrl,
      };
      const result =
        mode === "create"
          ? await createEvent(payload)
          : await updateEvent(eventId, payload);

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
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={onSubmit} className="grid min-w-0 gap-4">
        <Card className="grid gap-4 p-5">
          <Field label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" placeholder={ADMIN_POSTER_FALLBACKS.title} {...register("title")} />
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
                <option value="company_support">Company Support</option>
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
              <Input id="venueName" placeholder={ADMIN_POSTER_FALLBACKS.venueName} {...register("venueName")} />
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
              hint="Optional Google Maps link - leave blank if none."
            >
              <Input
                id="mapUrl"
                type="text"
                inputMode="url"
                placeholder="maps.google.com/..."
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
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Speaker & Details
          </p>

          <Field label="Speaker / Host name" htmlFor="speakerName" error={errors.speakerName?.message}>
            <Input id="speakerName" placeholder="e.g. Dr. Joey Sinchioco" {...register("speakerName")} />
          </Field>

          <div>
            <p className="mb-2 font-heading text-[12.5px] font-bold">Speaker photo</p>
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary text-brand">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Speaker" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-6" aria-hidden="true" />
                )}
              </div>
              <label
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand",
                  uploading && "pointer-events-none opacity-70",
                )}
              >
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" disabled={uploading} />
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading...
                  </>
                ) : photoUrl ? (
                  <>
                    <Check className="size-4 text-success" aria-hidden="true" /> Photo added - tap to change
                  </>
                ) : (
                  <>
                    <Camera className="size-4" aria-hidden="true" /> Upload speaker photo
                  </>
                )}
              </label>
            </div>
            {photoError ? <p className="mt-2 text-xs font-semibold text-destructive">{photoError}</p> : null}

            {photoUrl ? (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Adjust framing
                </p>
                <PhotoAdjuster url={photoUrl} focus={focus} onChange={setFocus} />
              </div>
            ) : null}
          </div>

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
        </Card>

        <MedicalLandingFields
          register={register}
          control={control}
          errors={errors}
          setValue={setValue}
          getValues={getValues}
        />

        {errors.root?.message ? (
          <p className="text-sm font-semibold text-destructive">{errors.root.message}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={pending || uploading}>
            {pending ? "Saving..." : mode === "create" ? "Create event" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="min-w-0 w-full lg:w-[360px]">
        <div className="w-full min-w-0 lg:sticky lg:top-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Event banner
          </p>
          <BannerStudio
            data={posterData}
            template={template}
            onTemplate={setTemplate}
            bannerUrl={bannerUrl}
            onBannerUrl={setBannerUrl}
          />
        </div>
      </div>
    </div>
  );
}
