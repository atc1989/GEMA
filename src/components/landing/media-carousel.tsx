"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import type { MediaEmbed } from "@/lib/ginhawa/media";

import "./media-carousel.css";

/**
 * Up to three videos/images in one section. Paging is native CSS scroll-snap;
 * the arrows and dots only nudge scrollLeft, so a swipe and a click agree.
 * ponytail: no carousel library — snap + one scroll listener is the whole thing.
 */
export function MediaCarousel({
  items,
  label = "Event media",
  className = "",
}: {
  items: MediaEmbed[];
  label?: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  /** Slide a click is scrolling toward, or null when the user is in control. */
  const target = useRef<number | null>(null);
  /**
   * Slides whose Drive iframe may mount. A Drive embed boots Google's whole
   * player, so mounting all three on load meant three players racing on one
   * phone — which is what left the frame black on a spinner. A slide earns its
   * iframe when it is first reached, and keeps it so returning is instant.
   */
  const [booted, setBooted] = useState<number[]>([0]);

  // Leaving a slide stops its video — otherwise the audio keeps playing from
  // a slide nobody can see any more.
  const pauseOthers = (keep: number) => {
    track.current?.querySelectorAll("video").forEach((video, i) => {
      if (i !== keep && !video.paused) video.pause();
    });
  };

  const settle = (to: number) => {
    setAt(to);
    pauseOthers(to);
    setBooted((prev) => (prev.includes(to) ? prev : [...prev, to]));
  };

  if (!items.length) return null;

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const to = Math.min(Math.max(n, 0), items.length - 1);
    // Move the dots and caption on the click, then ignore the frames the smooth
    // scroll passes through on the way. Without the target latch, onScroll
    // overwrote this on every animation frame and the active dot walked
    // backwards through every slide instead of jumping to the one tapped.
    target.current = to;
    settle(to);
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (target.current !== null) {
      if (i === target.current) target.current = null; // arrived; user has it back
      return;
    }
    settle(i);
  };

  // A touch beats an in-flight animation: hand control back immediately, so a
  // swipe during a smooth scroll is never swallowed by the latch above.
  const release = () => {
    target.current = null;
  };

  const many = items.length > 1;
  const caption = items[at]?.caption;
  // One Drive slide sets the height for all of them, so slides never jump.
  const hasDrive = items.some((m) => m.kind === "drive");
  const root = ["lm", hasDrive ? "lm--drive" : "", className].filter(Boolean).join(" ");

  return (
    <div className={root}>
      <div className="lm-frame">
        <div
          className="lm-track"
          ref={track}
          onScroll={onScroll}
          onPointerDown={release}
          role="group"
          aria-roledescription="carousel"
          aria-label={label}
        >
          {items.map((m, n) => (
            <div
              className="lm-slide"
              key={`${m.src}-${n}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${n + 1} of ${items.length}`}
            >
              {m.kind === "drive" ? (
                booted.includes(n) ? (
                  <iframe
                    src={m.src}
                    title={m.caption || `Slide ${n + 1}`}
                    allow="autoplay; encrypted-media"
                    loading="lazy"
                    allowFullScreen
                  />
                ) : (
                  // Same 16/9 box, so snap geometry does not shift when the
                  // real player takes its place.
                  <div className="lm-idle" aria-hidden="true" />
                )
              ) : m.kind === "image" ? (
                <img src={m.src} alt={m.caption || ""} loading={n ? "lazy" : undefined} />
              ) : (
                <video
                  controls
                  playsInline
                  // With a poster there is a real first frame to show, so the
                  // file itself can wait for a tap — that is bytes a guest on
                  // mobile data does not spend to see a still.
                  preload={m.poster ? "none" : "metadata"}
                  poster={m.poster}
                  src={m.src}
                />
              )}
            </div>
          ))}
        </div>

        {many ? (
          <>
            <button
              type="button"
              className="lm-arrow lm-arrow--prev"
              onClick={() => go(at - 1)}
              disabled={at === 0}
              aria-label="Previous"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lm-arrow lm-arrow--next"
              onClick={() => go(at + 1)}
              disabled={at === items.length - 1}
              aria-label="Next"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {many ? (
        <div className="lm-dots">
          {items.map((m, n) => (
            <button
              type="button"
              key={`${m.src}-dot-${n}`}
              className={n === at ? "lm-dot lm-dot--on" : "lm-dot"}
              onClick={() => go(n)}
              aria-label={`Go to slide ${n + 1}`}
              aria-current={n === at}
            />
          ))}
        </div>
      ) : null}

      {caption ? <p className="lm-cap">{caption}</p> : null}
    </div>
  );
}
