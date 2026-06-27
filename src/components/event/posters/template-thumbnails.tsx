"use client";

import { EventPoster } from "@/components/event/event-poster";
import { POSTER_TEMPLATE_LIST } from "@/components/event/posters/registry";
import { POSTER_H, POSTER_W } from "@/components/event/posters/shared";
import type { EventPosterData, PosterTemplateId } from "@/components/event/posters/types";
import { cn } from "@/lib/utils";

const THUMB_W = 96;
const SCALE = THUMB_W / POSTER_W;

/** Scrollable strip of live template previews. Presentational — the parent owns
 *  the selected state and what to do on change. */
export function PosterTemplateThumbnails({
  data,
  selected,
  onSelect,
}: {
  data: EventPosterData;
  selected: PosterTemplateId;
  onSelect: (id: PosterTemplateId) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {POSTER_TEMPLATE_LIST.map((tpl) => {
        const isActive = tpl.id === selected;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl.id)}
            aria-pressed={isActive}
            className="shrink-0 text-left"
          >
            <div
              className={cn(
                "overflow-hidden rounded-xl border-2 transition-colors",
                isActive ? "border-brand" : "border-transparent hover:border-border",
              )}
              style={{ width: THUMB_W, height: POSTER_H * SCALE }}
            >
              <div
                style={{
                  width: POSTER_W,
                  height: POSTER_H,
                  transform: `scale(${SCALE})`,
                  transformOrigin: "top left",
                }}
              >
                <EventPoster data={data} template={tpl.id} />
              </div>
            </div>
            <p
              className={cn(
                "mt-1.5 text-center text-[11px] font-bold",
                isActive ? "text-brand" : "text-muted-foreground",
              )}
            >
              {tpl.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
