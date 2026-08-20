"use client";

import { useState } from "react";
import { Check, ImagePlus, Loader2, X } from "lucide-react";

import { DownloadBannerButton, ScaledPoster } from "@/components/event/event-poster";
import { PosterTemplateThumbnails } from "@/components/event/posters/template-thumbnails";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import { uploadEventPhoto } from "@/lib/storage/event-photos";
import { cn } from "@/lib/utils";

/** Built-in 1080×1350 poster maker plus an always-visible custom upload. */
export function BannerStudio({
  data,
  template,
  onTemplate,
  bannerUrl,
  onBannerUrl,
  downloadLabel = "Download preview banner",
}: {
  data: EventPosterData;
  template: PosterTemplateId;
  onTemplate: (id: PosterTemplateId) => void;
  bannerUrl?: string;
  onBannerUrl?: (url: string | undefined) => void;
  downloadLabel?: string;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      {onBannerUrl ? (
        <div className="grid gap-2 rounded-2xl border-[1.5px] border-dashed border-brand/40 bg-brand/5 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-brand">Upload your own</p>
          <CustomBannerUpload bannerUrl={bannerUrl} onBannerUrl={onBannerUrl} />
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Or use a GEMA design
        </p>
        <ScaledPoster data={data} template={template} className="rounded-2xl shadow-lg" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Design
        </p>
        <PosterTemplateThumbnails data={data} selected={template} onSelect={onTemplate} />
      </div>
      <DownloadBannerButton data={data} template={template} label={downloadLabel} />
    </div>
  );
}

export function CustomBannerUpload({
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
            className="mx-auto max-h-[280px] w-full object-contain"
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
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border px-3 py-4 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand",
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
            <Check className="size-4 text-success" aria-hidden="true" /> Custom banner added — tap to change
          </>
        ) : (
          <>
            <ImagePlus className="size-4" aria-hidden="true" /> Upload your own banner
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
