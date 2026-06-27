"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { EventPoster, DownloadBannerButton } from "@/components/event/event-poster";
import { PosterTemplateThumbnails } from "@/components/event/posters/template-thumbnails";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import { setEventPosterTemplate } from "@/lib/actions/poster";

export function BannerTemplatePicker({
  data,
  eventId,
  initialTemplate,
}: {
  data: EventPosterData;
  eventId: string;
  initialTemplate: PosterTemplateId;
}) {
  const [selected, setSelected] = useState<PosterTemplateId>(initialTemplate);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (id: PosterTemplateId) => {
    if (id === selected) return;
    setSelected(id);
    setSaved(false);
    startTransition(async () => {
      const res = await setEventPosterTemplate(eventId, id);
      if (res.ok) setSaved(true);
    });
  };

  return (
    <div className="grid gap-4">
      {/* Main preview */}
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <EventPoster data={data} template={selected} />
      </div>

      {/* Template thumbnails */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Design</p>
          <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
            {pending ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : saved ? (
              <>
                <Check className="size-3 text-success" aria-hidden="true" /> Saved
              </>
            ) : null}
          </span>
        </div>

        <PosterTemplateThumbnails data={data} selected={selected} onSelect={choose} />
      </div>

      <DownloadBannerButton data={data} template={selected} />
    </div>
  );
}
