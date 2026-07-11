"use client";

import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolvePosterComponent } from "@/components/event/posters/registry";
import { POSTER_H, POSTER_W } from "@/components/event/posters/shared";
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

/**
 * On-screen poster that shrinks to fit its container (capped at native 360px).
 * `className` styles the box that hugs the scaled poster (rounding, shadow…).
 * Exports still use the fixed-size EventPoster, so downloads are unaffected.
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / POSTER_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef}>
      <div
        className={className}
        style={{ width: POSTER_W * scale, height: POSTER_H * scale, margin: "0 auto", overflow: "hidden" }}
      >
        <div style={{ width: POSTER_W, height: POSTER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <EventPoster data={data} template={template} />
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
