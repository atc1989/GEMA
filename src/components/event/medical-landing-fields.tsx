"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
  useFieldArray,
  useWatch,
} from "react-hook-form";

import {
  emptyClinician,
  initialsFromName,
  isDefaultLandingCopy,
  landingCopyFor,
  type LandingCopy,
} from "@/lib/ginhawa/prefill";
import {
  defaultLandingTemplateForEventType,
  LANDING_TEMPLATE_META,
  LANDING_TEMPLATES,
  type LandingTemplate,
} from "@/lib/ginhawa/templates";
import type { EventFormInput } from "@/lib/schemas/event";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  register: UseFormRegister<EventFormInput>;
  control: Control<EventFormInput>;
  errors: FieldErrors<EventFormInput>;
  setValue: UseFormSetValue<EventFormInput>;
  getValues: UseFormGetValues<EventFormInput>;
  /** Host/admin draft preview path, e.g. /e/[slug]/preview */
  previewHref?: string | null;
};

/**
 * Landing section for event create/edit.
 * Title/date/venue come from the event fields when the landing is saved.
 */
export function MedicalLandingFields({
  register,
  control,
  errors,
  setValue,
  getValues,
  previewHref,
}: Props) {
  const enabled = useWatch({ control, name: "landing.enabled" }) ?? false;
  const template = (useWatch({ control, name: "landing.template" }) ??
    "session") as LandingTemplate;
  const eventType = useWatch({ control, name: "eventType" });
  const wasEnabled = useRef(enabled);
  const lastTemplate = useRef(template);
  const { fields, append, remove } = useFieldArray({
    control,
    name: "landing.clinicians",
  });

  // Suggest a template the first time the host turns landing on for this visit.
  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      setValue("landing.template", defaultLandingTemplateForEventType(eventType), {
        shouldDirty: true,
      });
    }
    wasEnabled.current = enabled;
  }, [enabled, eventType, setValue]);

  // Move the Ask / takeaway copy over to the new template's wording, but only
  // for fields the host has left at a default. Anything they wrote is kept.
  useEffect(() => {
    if (lastTemplate.current === template) return;
    lastTemplate.current = template;

    const copy = landingCopyFor(template);
    for (const field of Object.keys(copy) as (keyof LandingCopy)[]) {
      if (!isDefaultLandingCopy(field, getValues(`landing.${field}`))) continue;
      setValue(`landing.${field}`, copy[field], { shouldDirty: true });
    }
  }, [template, getValues, setValue]);

  const landingErrors = errors.landing;
  const isClinical = template === "medical" || template === "checkup";
  const peopleLabel = isClinical ? "Clinicians" : "Speakers / hosts";

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Event landing page
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Optional public page at <span className="font-mono">/e/[slug]</span>. Goes live when
            this event is published.
            {previewHref ? (
              <>
                {" "}
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand"
                >
                  Preview draft
                </a>
              </>
            ) : null}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            {...register("landing.enabled")}
          />
          Include landing
        </label>
      </div>

      {enabled ? (
        <div className="grid gap-4">
          <Field
            label="Template"
            htmlFor="landing-template"
            error={landingErrors?.template?.message}
            hint={LANDING_TEMPLATE_META[template]?.hint}
          >
            <Select id="landing-template" {...register("landing.template")}>
              {LANDING_TEMPLATES.map((id) => (
                <option key={id} value={id}>
                  {LANDING_TEMPLATE_META[id].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Hero details"
            htmlFor="landing-heroWhat"
            error={landingErrors?.heroWhat?.message}
            hint="Shown under the title. Defaults to the event description if blank."
          >
            <Textarea id="landing-heroWhat" rows={3} {...register("landing.heroWhat")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="E-Points gift"
              htmlFor="landing-giftPoints"
              error={landingErrors?.giftPoints?.message}
              hint={isClinical ? undefined : "Set to 0 to hide the gift block."}
            >
              <Input
                id="landing-giftPoints"
                inputMode="numeric"
                {...register("landing.giftPoints")}
              />
            </Field>
            <Field
              label="Worth (₱)"
              htmlFor="landing-giftPeso"
              error={landingErrors?.giftPeso?.message}
            >
              <Input id="landing-giftPeso" inputMode="numeric" {...register("landing.giftPeso")} />
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black tracking-tight">{peopleLabel}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  Up to 4. Credentials support **bold** and lists.
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

            {fields.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">None added yet.</p>
            ) : null}

            {fields.map((field, i) => (
              <div key={field.id} className="grid gap-3 rounded-xl border border-border/50 p-3">
                <input type="hidden" {...register(`landing.clinicians.${i}.id`)} />
                <input type="hidden" {...register(`landing.clinicians.${i}.photo`)} />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    {isClinical ? "Clinician" : "Speaker"} {i + 1}
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                    <Trash2 aria-hidden="true" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Name"
                    htmlFor={`landing-clinician-name-${i}`}
                    error={landingErrors?.clinicians?.[i]?.name?.message}
                    required
                  >
                    <Input
                      id={`landing-clinician-name-${i}`}
                      {...register(`landing.clinicians.${i}.name`, {
                        onBlur: () => {
                          const name = getValues(`landing.clinicians.${i}.name`);
                          if (!getValues(`landing.clinicians.${i}.initials`)?.toString().trim()) {
                            setValue(
                              `landing.clinicians.${i}.initials`,
                              initialsFromName(String(name ?? "")),
                            );
                          }
                        },
                      })}
                    />
                  </Field>
                  <Field label="Suffix" htmlFor={`landing-clinician-suffix-${i}`}>
                    <Input
                      id={`landing-clinician-suffix-${i}`}
                      {...register(`landing.clinicians.${i}.suffix`)}
                    />
                  </Field>
                  <Field label="Role" htmlFor={`landing-clinician-role-${i}`}>
                    <Input
                      id={`landing-clinician-role-${i}`}
                      {...register(`landing.clinicians.${i}.role`)}
                    />
                  </Field>
                  <Field label="Initials" htmlFor={`landing-clinician-initials-${i}`}>
                    <Input
                      id={`landing-clinician-initials-${i}`}
                      {...register(`landing.clinicians.${i}.initials`)}
                    />
                  </Field>
                </div>
                <Field label="Licence" htmlFor={`landing-clinician-licence-${i}`}>
                  <Input
                    id={`landing-clinician-licence-${i}`}
                    {...register(`landing.clinicians.${i}.licence`)}
                  />
                </Field>
                <Field label="Credentials (markdown)" htmlFor={`landing-clinician-creds-${i}`}>
                  <Textarea
                    id={`landing-clinician-creds-${i}`}
                    rows={4}
                    {...register(`landing.clinicians.${i}.credentialsMd`)}
                  />
                </Field>
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 p-4">
            <p className="text-sm font-black tracking-tight">Video</p>
            <Field
              label="Google Drive or video URL"
              htmlFor="landing-videoUrl"
              error={landingErrors?.videoUrl?.message}
            >
              <Input
                id="landing-videoUrl"
                type="text"
                inputMode="url"
                {...register("landing.videoUrl")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Length label" htmlFor="landing-videoLength">
                <Input id="landing-videoLength" {...register("landing.videoLength")} />
              </Field>
              <Field label="Caption" htmlFor="landing-videoCaption">
                <Input id="landing-videoCaption" {...register("landing.videoCaption")} />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 p-4">
            <p className="text-sm font-black tracking-tight">
              {isClinical ? "Ask" : "Why attend"}
            </p>
            <Field label="Heading" htmlFor="landing-askTitle">
              <Input id="landing-askTitle" {...register("landing.askTitle")} />
            </Field>
            <Field label="Body" htmlFor="landing-askBody">
              <Textarea id="landing-askBody" rows={3} {...register("landing.askBody")} />
            </Field>
            <Field label="Punchline" htmlFor="landing-askHit">
              <Input id="landing-askHit" {...register("landing.askHit")} />
            </Field>
          </div>

          {isClinical ? (
            <div className="grid gap-3 rounded-xl border border-border/70 p-4">
              <p className="text-sm font-black tracking-tight">Why the gut</p>
              <Field label="Heading" htmlFor="landing-gutTitle">
                <Input id="landing-gutTitle" {...register("landing.gutTitle")} />
              </Field>
              <Field label="Body" htmlFor="landing-gutBody">
                <Textarea id="landing-gutBody" rows={3} {...register("landing.gutBody")} />
              </Field>
              <Field label="Close" htmlFor="landing-gutClose">
                <Input id="landing-gutClose" {...register("landing.gutClose")} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 rounded-xl border border-border/70 p-4">
              <p className="text-sm font-black tracking-tight">What you leave with</p>
              <Field label="Heading" htmlFor="landing-gutTitle">
                <Input id="landing-gutTitle" {...register("landing.gutTitle")} />
              </Field>
              <Field label="Body" htmlFor="landing-gutBody">
                <Textarea id="landing-gutBody" rows={3} {...register("landing.gutBody")} />
              </Field>
              <Field label="Close" htmlFor="landing-gutClose">
                <Input id="landing-gutClose" {...register("landing.gutClose")} />
              </Field>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
