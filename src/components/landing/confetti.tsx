"use client";

import { useEffect, useState } from "react";

import "./confetti.css";

const COLOURS = ["#f5b716", "#1f5d99", "#2f7fd6", "#dfd7d5", "#ffffff", "#1e9e57"];

type Bit = {
  id: string;
  left: number;
  tx: number;
  ty: number;
  rot: number;
  colour: string;
  w: number;
  h: number;
  seconds: number;
  delay: number;
};

/**
 * Fires a burst whenever `fire` changes to a new non-zero value — pass a
 * counter or a timestamp. Purely decorative, so reduced-motion gets nothing.
 * ponytail: 90 spans and one keyframe, no canvas and no confetti library.
 */
export function Confetti({ fire }: { fire: number }) {
  const [bits, setBits] = useState<Bit[]>([]);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    setBits(
      Array.from({ length: 90 }, (_, i) => ({
        id: `${fire}-${i}`,
        left: 50 + (Math.random() - 0.5) * 70,
        tx: (Math.random() - 0.5) * 620,
        ty: 130 + Math.random() * 280,
        rot: (Math.random() - 0.5) * 900,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 12,
        seconds: 1.6 + Math.random() * 0.8,
        delay: Math.random() * 0.2,
      })),
    );
    const timer = setTimeout(() => setBits([]), 2900);
    return () => clearTimeout(timer);
  }, [fire]);

  if (!bits.length) return null;

  return (
    <div className="cf-wrap" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.id}
          className="cf"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.colour,
              "--cf-tx": `${b.tx}px`,
              "--cf-ty": `${b.ty}px`,
              "--cf-rot": `${b.rot}deg`,
              animationDuration: `${b.seconds}s`,
              animationDelay: `${b.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
