"use client";

import { forwardRef, useRef, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolvePosterComponent } from "@/components/event/posters/registry";
import {
  DEFAULT_POSTER_TEMPLATE,
  type EventPosterData,
  type PosterTemplateId,
} from "@/components/event/posters/types";

export type { EventPosterData } from "@/components/event/posters/types";

/**
 * Template-aware poster. Renders the chosen design at 360×450; exported at
 * 1080×1350 (pixelRatio 3). Defaults to Aurora so existing callers are unchanged.
 */
export const EventPoster = forwardRef<
  HTMLDivElement,
  { data: EventPosterData; template?: PosterTemplateId }
>(function EventPoster({ data, template = DEFAULT_POSTER_TEMPLATE }, ref) {
  const Poster = resolvePosterComponent(template);
  return <Poster ref={ref} data={data} />;
});

/** Standalone download button — renders a hidden poster, captures, downloads. */
export function DownloadBannerButton({
  data,
  template = DEFAULT_POSTER_TEMPLATE,
  label = "Download banner",
}: {
  data: EventPosterData;
  template?: PosterTemplateId;
  label?: string;
}) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const { toPng } = await import("html-to-image");
      const node = hiddenRef.current;
      if (!node) return;
      try {
        const url = await toPng(node, { pixelRatio: 3, cacheBust: true });
        const a = document.createElement("a");
        a.download = "gema-event-banner.png";
        a.href = url;
        a.click();
      } catch {
        // silent — user can retry
      }
    });
  };

  return (
    <>
      <div
        style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none", zIndex: -1 }}
        aria-hidden="true"
      >
        <EventPoster ref={hiddenRef} data={data} template={template} />
      </div>

      <Button type="button" variant="brand" onClick={handleDownload} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending ? "Rendering…" : label}
      </Button>
    </>
  );
}
