"use client";

import { forwardRef, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolvePosterComponent } from "@/components/event/posters/registry";
import { POSTER_H, POSTER_W } from "@/components/event/posters/shared";
import {
  DEFAULT_POSTER_TEMPLATE,
  type EventPosterData,
  type PosterTemplateId,
} from "@/components/event/posters/types";
import { cn } from "@/lib/utils";

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

/**
 * 4:5 on-screen poster. Aspect-ratio sizes the frame from width alone, so the
 * inner 360×450 canvas cannot stretch or collapse the box. The canvas is
 * absolutely positioned and scaled to the measured width.
 */
export function ScaledPoster({
  data,
  template,
  className,
}: {
  data: EventPosterData;
  template?: PosterTemplateId;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const w = host.getBoundingClientRect().width;
      if (w > 0) setScale(Math.min(1, w / POSTER_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="w-full min-w-0 max-w-[360px]">
      <div
        className={cn("relative w-full overflow-hidden", className)}
        style={{ aspectRatio: `${POSTER_W} / ${POSTER_H}` }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            style={{
              width: POSTER_W,
              height: POSTER_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              overflow: "hidden",
            }}
          >
            <EventPoster data={data} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}

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
