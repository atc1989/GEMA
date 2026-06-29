"use client";

import { useRef } from "react";
import { RotateCcw, ZoomIn } from "lucide-react";

import { DEFAULT_PHOTO_FOCUS, hostPhotoStyle, type PhotoFocus } from "./shared";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Drag-to-reposition + zoom control for the host photo. Emits a PhotoFocus the
 * poster templates apply. Pure pointer events — no library.
 */
export function PhotoAdjuster({
  url,
  focus,
  onChange,
  onCommit,
}: {
  url: string;
  focus: PhotoFocus;
  onChange: (f: PhotoFocus) => void;
  onCommit?: (f: PhotoFocus) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; fx: number; fy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, fx: focus.x, fy: focus.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    // Dragging the image moves the visible region the opposite way; divide by
    // zoom so panning feels consistent when zoomed in.
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    onChange({ ...focus, x: clamp(d.fx - dx / focus.zoom), y: clamp(d.fy - dy / focus.zoom) });
  };

  const endDrag = () => {
    if (drag.current) {
      drag.current = null;
      onCommit?.(focus);
    }
  };

  const setZoom = (zoom: number) => onChange({ ...focus, zoom });

  return (
    <div>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative aspect-[4/3] w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-border bg-secondary active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Adjust framing" crossOrigin="anonymous" draggable={false} style={hostPhotoStyle(focus)} />
        {/* rule-of-thirds guides */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
        </div>
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
          Drag to reposition
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={focus.zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          onPointerUp={() => onCommit?.(focus)}
          onKeyUp={() => onCommit?.(focus)}
          aria-label="Zoom"
          className="h-1.5 flex-1 cursor-pointer accent-brand"
        />
        <button
          type="button"
          onClick={() => {
            onChange(DEFAULT_PHOTO_FOCUS);
            onCommit?.(DEFAULT_PHOTO_FOCUS);
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand",
          )}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}
