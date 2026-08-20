"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { BannerStudio } from "@/components/event/banner-studio";
import { PhotoAdjuster } from "@/components/event/posters/photo-adjuster";
import { asPhotoFocus, type PhotoFocus } from "@/components/event/posters/shared";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import {
  setEventCustomBanner,
  setEventPhotoFocus,
  setEventPosterTemplate,
} from "@/lib/actions/poster";

export function BannerTemplatePicker({
  data,
  eventId,
  initialTemplate,
  initialFocus,
  initialBannerUrl,
}: {
  data: EventPosterData;
  eventId: string;
  initialTemplate: PosterTemplateId;
  initialFocus?: PhotoFocus;
  initialBannerUrl?: string | null;
}) {
  const [selected, setSelected] = useState<PosterTemplateId>(initialTemplate);
  const [focus, setFocus] = useState<PhotoFocus>(asPhotoFocus(initialFocus));
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(initialBannerUrl ?? undefined);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const previewData: EventPosterData = { ...data, photoFocus: focus };

  const persist = (work: () => Promise<{ ok: boolean }>) => {
    setSaved(false);
    startTransition(async () => {
      const res = await work();
      if (res.ok) setSaved(true);
    });
  };

  const chooseTemplate = (id: PosterTemplateId) => {
    if (id === selected) return;
    setSelected(id);
    persist(() => setEventPosterTemplate(eventId, id));
  };

  const chooseBannerUrl = (url: string | undefined) => {
    setBannerUrl(url);
    persist(() => setEventCustomBanner(eventId, url ?? null));
  };

  const commitFocus = (f: PhotoFocus) => {
    persist(() => setEventPhotoFocus(eventId, f));
  };

  return (
    <div className="grid gap-4">
      <BannerStudio
        data={previewData}
        template={selected}
        onTemplate={chooseTemplate}
        bannerUrl={bannerUrl}
        onBannerUrl={chooseBannerUrl}
        downloadLabel="Download banner"
      />

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
    </div>
  );
}
