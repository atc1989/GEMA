import { forwardRef } from "react";

import { accentForType } from "./accent";
import { GemaWordmark } from "./gema-wordmark";
import { POSTER_H, POSTER_W, posterDate, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Bold Type — solid accent field, oversized title fills the canvas, compact
 *  info band at the foot. High impact, text-only. */
export const BoldTypePoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function BoldTypePoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);

    return (
      <div
        ref={ref}
        style={{
          width: POSTER_W,
          height: POSTER_H,
          position: "relative",
          overflow: "hidden",
          background: ac.accent,
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "26px 24px 22px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Top row: brand + type tag */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <GemaWordmark height={16} color="#ffffff" />
          <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 20, padding: "4px 10px" }}>
            {ac.label}
          </div>
        </div>

        {/* Giant title */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 0.98, textTransform: "uppercase", letterSpacing: -1.5, wordBreak: "break-word" }}>
            {data.title || "Your Event Title"}
          </div>
        </div>

        {/* Info band */}
        <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 14, padding: "14px 16px" }}>
          {date.hasDate ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{date.day}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{date.month}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{date.dow} · {date.time}</span>
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 800 }}>Date & time TBA</div>
          )}
          <div style={{ height: 1, background: "rgba(255,255,255,0.2)", margin: "11px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {venue}
          </div>
          {data.speakerName ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.78)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ✦ {data.speakerName}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
          RADIATING WELLNESS · TRANSFORMING LIVES
        </div>
      </div>
    );
  },
);
