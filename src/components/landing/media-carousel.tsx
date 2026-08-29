"use client";

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

  if (!items.length) return null;

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const to = Math.min(Math.max(n, 0), items.length - 1);
    // Move the dots and caption on the click, not on the scroll event the
    // smooth scroll will eventually emit — onScroll only has to catch swipes.
    setAt(to);
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    setAt(Math.round(el.scrollLeft / el.clientWidth));
  };

  const many = items.length > 1;
  const caption = items[at]?.caption;

  return (
    <div className={className ? `lm ${className}` : "lm"}>
      <div className="lm-frame">
        <div
          className="lm-track"
          ref={track}
          onScroll={onScroll}
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
                <iframe
                  src={m.src}
                  title={m.caption || `Slide ${n + 1}`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : m.kind === "image" ? (
                <img src={m.src} alt={m.caption || ""} loading={n ? "lazy" : undefined} />
              ) : (
                <video controls playsInline preload="metadata" src={m.src} />
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
              ‹
            </button>
            <button
              type="button"
              className="lm-arrow lm-arrow--next"
              onClick={() => go(at + 1)}
              disabled={at === items.length - 1}
              aria-label="Next"
            >
              ›
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
