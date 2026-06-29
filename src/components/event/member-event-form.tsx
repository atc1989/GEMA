"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  Camera,
  Check,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Monitor,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";

import { createMemberEvent, updateMemberEvent } from "@/lib/actions/member-events";
import { eventFormSchema, type EventFormInput } from "@/lib/schemas/event";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EventPoster, DownloadBannerButton, type EventPosterData } from "@/components/event/event-poster";
import { PosterTemplateThumbnails } from "@/components/event/posters/template-thumbnails";
import { asPosterTemplateId, type PosterTemplateId } from "@/components/event/posters/types";
import { PhotoAdjuster } from "@/components/event/posters/photo-adjuster";
import { asPhotoFocus, type PhotoFocus } from "@/components/event/posters/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Public Storage bucket for uploaded event/speaker photos (see setup SQL). */
const PHOTO_BUCKET = "event-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const TYPE_OPTIONS: { value: EventFormInput["eventType"]; label: string }[] = [
  { value: "presentation", label: "Presentation" },
  { value: "business", label: "Business" },
  { value: "training", label: "Training" },
  { value: "sizzle", label: "Sizzle" },
  { value: "mentoring", label: "Mentoring" },
  { value: "fellowship", label: "Fellowship" },
  { value: "other", label: "Other" },
];

// Suggested names that also preset the event type.
const NAME_SUGGESTIONS: { label: string; type: EventFormInput["eventType"] }[] = [
  { label: "Saturday Sizzle", type: "sizzle" },
  { label: "Product Presentation", type: "presentation" },
  { label: "Business Opportunity", type: "business" },
  { label: "Wellness Training", type: "training" },
  { label: "Core Leaders Mentoring", type: "mentoring" },
];

type MemberEventFormProps = {
  selfName?: string;
} & (
  | { mode: "create"; eventId?: undefined; defaultValues?: Partial<EventFormInput> }
  | { mode: "edit"; eventId: string; defaultValues: Partial<EventFormInput> }
);

export function MemberEventForm({ mode, eventId, defaultValues, selfName }: MemberEventFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [template, setTemplate] = useState<PosterTemplateId>(
    asPosterTemplateId(defaultValues?.posterTemplate),
  );
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(
    typeof defaultValues?.speakerPhotoUrl === "string" ? defaultValues.speakerPhotoUrl : undefined,
  );
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [focus, setFocus] = useState<PhotoFocus>(asPhotoFocus(defaultValues?.photoFocus));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  const selectedType = (watch("eventType") ?? "presentation") as EventFormInput["eventType"];
  const selectedVis = (watch("visibility") ?? "public") as "public" | "private";
  const selectedMode = (watch("mode") ?? "in_person") as "in_person" | "online" | "hybrid";
  const showVenue = selectedMode !== "online";
  const showOnline = selectedMode !== "in_person";

  const capRaw = watch("capacity");
  const capacity = capRaw === "" || capRaw == null ? undefined : Number(capRaw);

  const posterData: EventPosterData = {
    title: watch("title") || "",
    eventType: selectedType,
    mode: selectedMode ?? "in_person",
    startsAt: watch("startsAt"),
    venueName: watch("venueName"),
    speakerName: watch("speakerName"),
    speakerPhotoUrl: photoUrl,
    photoFocus: focus,
  };

  const pickName = (label: string, type: EventFormInput["eventType"]) => {
    setValue("title", label, { shouldDirty: true, shouldValidate: true });
    setValue("eventType", type, { shouldDirty: true });
  };

  const useMyName = () => {
    if (selfName) setValue("speakerName", selfName, { shouldDirty: true });
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setPhotoError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `speakers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setPhotoError("Upload failed. Try again.");
      } else {
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        setPhotoUrl(data.publicUrl);
      }
    } catch {
      setPhotoError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const applyFieldErrors = (fieldErrors?: Record<string, string[] | undefined>) => {
    if (!fieldErrors) return;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) setError(name as keyof EventFormInput, { message: messages[0] });
    }
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const payload = { ...values, posterTemplate: template, speakerPhotoUrl: photoUrl, photoFocus: focus };
      const result =
        mode === "create"
          ? await createMemberEvent(payload)
          : await updateMemberEvent(eventId, payload);

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
      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Basics */}
        <Card className="grid gap-4 p-5">
          <SectionLabel>Basics</SectionLabel>
          <Field label="Event name" htmlFor="title" required error={errors.title?.message}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {NAME_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => pickName(s.label, s.type)}
                  className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Input id="title" placeholder="Saturday Sizzle" {...register("title")} />
          </Field>

          <div>
            <FieldLabel>Type</FieldLabel>
            <PillGroup
              value={selectedType}
              onChange={(v) => setValue("eventType", v as EventFormInput["eventType"], { shouldDirty: true })}
              options={TYPE_OPTIONS}
            />
          </div>
        </Card>

        {/* When & Where */}
        <Card className="grid gap-4 p-5">
          <SectionLabel>When &amp; Where</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at" htmlFor="startsAt" required error={errors.startsAt?.message}>
              <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
            </Field>
            <Field label="Ends at" htmlFor="endsAt" error={errors.endsAt?.message}>
              <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
            </Field>
          </div>

          <div>
            <FieldLabel>Format</FieldLabel>
            <PillGroup
              value={selectedMode}
              onChange={(v) => setValue("mode", v as EventFormInput["mode"], { shouldDirty: true })}
              options={[
                { value: "in_person", label: "In person", icon: <MapPin className="size-3.5" /> },
                { value: "online", label: "Online", icon: <Monitor className="size-3.5" /> },
                { value: "hybrid", label: "Hybrid", icon: <Globe className="size-3.5" /> },
              ]}
            />
          </div>

          {showVenue ? (
            <div className="grid gap-4 rounded-xl border border-border/60 bg-secondary/30 p-4">
              <Field label="Venue name" htmlFor="venueName" required error={errors.venueName?.message}>
                <Input id="venueName" placeholder="Davao Hub Center" {...register("venueName")} />
              </Field>
              <Field label="Venue address" htmlFor="venueAddress" error={errors.venueAddress?.message}>
                <Input id="venueAddress" placeholder="Street, Barangay, City" {...register("venueAddress")} />
              </Field>
              <Field label="Map URL (optional)" htmlFor="mapUrl" error={errors.mapUrl?.message}>
                <Input id="mapUrl" inputMode="url" placeholder="maps.app.goo.gl/…" {...register("mapUrl")} />
              </Field>
            </div>
          ) : null}

          {showOnline ? (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
              <Field label="Online URL" htmlFor="onlineUrl" required error={errors.onlineUrl?.message}>
                <Input id="onlineUrl" type="url" placeholder="https://zoom.us/j/…" {...register("onlineUrl")} />
              </Field>
            </div>
          ) : null}
        </Card>

        {/* Speaker & Details */}
        <Card className="grid gap-4 p-5">
          <SectionLabel>Speaker &amp; Details</SectionLabel>

          <Field label="Speaker / Host name (optional)" htmlFor="speakerName" error={errors.speakerName?.message}>
            <Input id="speakerName" placeholder="e.g. Dr. Joey Sinchioco" {...register("speakerName")} />
            {selfName ? (
              <button
                type="button"
                onClick={useMyName}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <UserRound className="size-3.5" aria-hidden="true" />
                Me — use my name
              </button>
            ) : null}
          </Field>

          {/* Speaker photo upload */}
          <div>
            <FieldLabel>Speaker photo (optional)</FieldLabel>
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
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
                  </>
                ) : photoUrl ? (
                  <>
                    <Check className="size-4 text-success" aria-hidden="true" /> Photo added — tap to change
                  </>
                ) : (
                  <>
                    <Camera className="size-4" aria-hidden="true" /> Upload speaker photo
                  </>
                )}
              </label>
            </div>
            {photoError ? <p className="mt-2 text-xs font-semibold text-destructive">{photoError}</p> : null}
            <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
              Shows on the photo banner designs and the invite page. PNG/JPG up to 5 MB.
            </p>

            {photoUrl ? (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Adjust framing
                </p>
                <PhotoAdjuster url={photoUrl} focus={focus} onChange={setFocus} />
              </div>
            ) : null}
          </div>

          <Field label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={4} placeholder="What will attendees learn or experience?" {...register("description")} />
          </Field>
        </Card>

        {/* Settings */}
        <Card className="grid gap-4 p-5">
          <SectionLabel>Settings</SectionLabel>

          <div>
            <FieldLabel>Visibility</FieldLabel>
            <PillGroup
              value={selectedVis}
              onChange={(v) => setValue("visibility", v as EventFormInput["visibility"], { shouldDirty: true })}
              options={[
                { value: "private", label: "Invite-only", icon: <Lock className="size-3.5" /> },
                { value: "public", label: "Public", icon: <Globe className="size-3.5" /> },
              ]}
            />
            <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
              {selectedVis === "public"
                ? "Anyone with the link can register."
                : "Only people you invite can register."}
            </p>
          </div>

          <div>
            <FieldLabel>Max attendance</FieldLabel>
            <CapacityStepper
              value={Number.isFinite(capacity) ? (capacity as number) : undefined}
              onChange={(v) => setValue("capacity", v ?? undefined, { shouldDirty: true })}
            />
            {errors.capacity?.message ? (
              <p className="mt-2 text-xs font-semibold text-destructive">{errors.capacity.message}</p>
            ) : null}
          </div>
        </Card>

        {errors.root?.message ? (
          <p className="text-sm font-semibold text-destructive">{errors.root.message}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={pending || uploading}>
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
            <EventPoster data={posterData} template={template} />
          </div>
          <div className="mt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Design</p>
            <PosterTemplateThumbnails data={posterData} selected={template} onSelect={setTemplate} />
          </div>
          <div className="mt-3">
            <DownloadBannerButton data={posterData} template={template} label="Download preview banner" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-heading text-[12.5px] font-bold">{children}</p>;
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold transition-colors",
              active
                ? "border-brand bg-brand text-white"
                : "border-border text-muted-foreground hover:border-brand/50",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CapacityStepper({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  if (value === undefined) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-heading text-sm font-extrabold">Unlimited</span>
        <button
          type="button"
          onClick={() => onChange(20)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-secondary"
        >
          Set a limit
        </button>
      </div>
    );
  }
  const btn =
    "flex size-10 items-center justify-center rounded-xl border-[1.5px] border-border bg-card text-brand transition-colors hover:border-brand disabled:opacity-40";
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={btn} aria-label="Decrease">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-9 text-center font-heading text-xl font-extrabold tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className={btn} aria-label="Increase">
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <span className="text-sm font-bold text-muted-foreground">seats</span>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-brand"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        Unlimited
      </button>
    </div>
  );
}
