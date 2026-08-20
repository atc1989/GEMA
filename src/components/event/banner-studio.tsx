"use client";

import { useState } from "react";
import { Check, ImagePlus, Loader2, Palette, X } from "lucide-react";

import { DownloadBannerButton, ScaledPoster } from "@/components/event/event-poster";
import { PosterTemplateThumbnails } from "@/components/event/posters/template-thumbnails";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import { uploadEventPhoto } from "@/lib/storage/event-photos";
import { cn } from "@/lib/utils";

export type BannerSource = "maker" | "upload";

export function asBannerSource(value: unknown, hasBannerUrl: boolean): BannerSource {
  if (value === "maker" || value === "upload") return value;
  return hasBannerUrl ? "upload" : "maker";
}

export function BannerStudio({
  data,
  template,
  onTemplate,
  bannerUrl,
  onBannerUrl,
  source,
  onSource,
  downloadLabel = "Download preview banner",
}: {
  data: EventPosterData;
  template: PosterTemplateId;
  onTemplate: (id: PosterTemplateId) => void;
  bannerUrl?: string;
  onBannerUrl: (url: string | undefined) => void;
  source: BannerSource;
  onSource: (source: BannerSource) => void;
  downloadLabel?: string;
}) {
  return (
    <div className="grid gap-4">
      <BannerSourceToggle source={source} onSource={onSource} />

      {source === "upload" ? (
        <CustomBannerUpload bannerUrl={bannerUrl} onBannerUrl={onBannerUrl} />
      ) : (
        <>
          <ScaledPoster data={data} template={template} className="rounded-2xl shadow-lg" />
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Design
            </p>
            <PosterTemplateThumbnails data={data} selected={template} onSelect={onTemplate} />
          </div>
          <DownloadBannerButton data={data} template={template} label={downloadLabel} />
        </>
      )}
    </div>
  );
}

function BannerSourceToggle({
  source,
  onSource,
}: {
  source: BannerSource;
  onSource: (source: BannerSource) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Choose one
      </p>
      <SourceButton
        active={source === "maker"}
        onClick={() => onSource("maker")}
        icon={<Palette className="size-4" aria-hidden="true" />}
        label="GEMA design"
        hint="Built-in banner maker"
      />
      <SourceButton
        active={source === "upload"}
        onClick={() => onSource("upload")}
        icon={<ImagePlus className="size-4" aria-hidden="true" />}
        label="Upload my own"
        hint="Use a custom image"
      />
    </div>
  );
}

function SourceButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full min-w-0 flex-col items-start gap-0.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-border bg-secondary/60 text-muted-foreground hover:border-brand hover:text-brand",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-black">
        {icon}
        {label}
      </span>
      <span className={cn("text-[11px] font-semibold", active ? "text-white/80" : "text-muted-foreground")}>
        {hint}
      </span>
    </button>
  );
}

function CustomBannerUpload({
  bannerUrl,
  onBannerUrl,
}: {
  bannerUrl?: string;
  onBannerUrl: (url: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadEventPhoto(file, "banners");
      if (result.ok) onBannerUrl(result.url);
      else setError(result.error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-3">
      {bannerUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-secondary/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt="Custom event banner"
            className="mx-auto max-h-[480px] w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onBannerUrl(undefined)}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shadow-sm hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex aspect-[4/5] max-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 text-sm font-semibold text-muted-foreground">
          No custom banner yet
        </div>
      )}

      <label
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border px-3 py-3 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={uploading} />
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
          </>
        ) : bannerUrl ? (
          <>
            <Check className="size-4 text-success" aria-hidden="true" /> Banner added — tap to change
          </>
        ) : (
          <>
            <ImagePlus className="size-4" aria-hidden="true" /> Upload banner image
          </>
        )}
      </label>
      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
      <p className="text-[11px] font-semibold text-muted-foreground">
        PNG or JPG up to 5 MB. 1080 × 1350 (4:5) matches Messenger and Instagram portrait posts.
      </p>
    </div>
  );
}
