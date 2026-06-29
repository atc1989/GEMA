"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { EventPoster, DownloadBannerButton } from "@/components/event/event-poster";
import { PosterTemplateThumbnails } from "@/components/event/posters/template-thumbnails";
import { PhotoAdjuster } from "@/components/event/posters/photo-adjuster";
import { asPhotoFocus, type PhotoFocus } from "@/components/event/posters/shared";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import { setEventPosterTemplate, setEventPhotoFocus } from "@/lib/actions/poster";

export function BannerTemplatePicker({
  data,
  eventId,
  initialTemplate,
  initialFocus,
}: {
  data: EventPosterData;
  eventId: string;
  initialTemplate: PosterTemplateId;
  initialFocus?: PhotoFocus;
}) {
  const [selected, setSelected] = useState<PosterTemplateId>(initialTemplate);
  const [focus, setFocus] = useState<PhotoFocus>(asPhotoFocus(initialFocus));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const previewData: EventPosterData = { ...data, photoFocus: focus };

  const choose = (id: PosterTemplateId) => {
    if (id === selected) return;
    setSelected(id);
    setSaved(false);
    startTransition(async () => {
      const res = await setEventPosterTemplate(eventId, id);
      if (res.ok) setSaved(true);
    });
  };

  const commitFocus = (f: PhotoFocus) => {
    setSaved(false);
    startTransition(async () => {
      const res = await setEventPhotoFocus(eventId, f);
      if (res.ok) setSaved(true);
    });
  };

  return (
    <div className="grid gap-4">
      {/* Main preview */}
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <EventPoster data={previewData} template={selected} />
      </div>

      <div className="flex items-center justify-end text-[11px] font-bold text-muted-foreground">
        {pending ? (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving…
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1">
            <Check className="size-3 text-success" aria-hidden="true" /> Saved
          </span>
        ) : null}
      </div>

      {/* Framing adjuster (only when there's a photo) */}
      {data.speakerPhotoUrl ? (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            Adjust framing
          </p>
          <PhotoAdjuster
            url={data.speakerPhotoUrl}
            focus={focus}
            onChange={setFocus}
            onCommit={commitFocus}
          />
        </div>
      ) : null}

      {/* Template thumbnails */}
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Design</p>
        <PosterTemplateThumbnails data={previewData} selected={selected} onSelect={choose} />
      </div>

      <DownloadBannerButton data={previewData} template={selected} />
    </div>
  );
}
