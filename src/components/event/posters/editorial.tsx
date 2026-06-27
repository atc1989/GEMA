import { forwardRef } from "react";

import { accentForType } from "./accent";
import { POSTER_H, POSTER_W, posterDate, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Editorial Light — clean white/cream layout with an accent bar and structured
 *  info rows. Professional, corporate look. */
export const EditorialPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function EditorialPoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);

    const Row = ({ label, value }: { label: string; value: string }) => (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 0", borderBottom: "1px solid #e8edf4" }}>
        <span style={{ width: 60, flexShrink: 0, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: ac.accent }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2740", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </div>
    );

    return (
      <div
        ref={ref}
        style={{
          width: POSTER_W,
          height: POSTER_H,
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          color: "#1a2740",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Accent bar */}
        <div style={{ height: 8, background: ac.accent, flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 20px" }}>
          {/* Brand + type */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2.5, color: ac.deep }}>GEMA</div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: ac.accent, background: ac.soft, borderRadius: 20, padding: "4px 10px" }}>
              {ac.label}
            </div>
          </div>

          {/* Title */}
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.14, letterSpacing: -0.5, color: "#16233c", wordBreak: "break-word" }}>
              {data.title || "Your Event Title"}
            </div>
          </div>

          {/* Big date */}
          {date.hasDate ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 14px" }}>
              <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: ac.accent }}>{date.day}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{date.month}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>{date.dow} · {date.time}</div>
              </div>
            </div>
          ) : (
            <div style={{ margin: "10px 0 14px", fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>Date & time TBA</div>
          )}

          {/* Info rows */}
          <Row label="Venue" value={venue} />
          {data.speakerName ? <Row label="Speaker" value={data.speakerName} /> : null}

          <div style={{ marginTop: 14, fontSize: 7.5, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8" }}>
            RADIATING WELLNESS · TRANSFORMING LIVES
          </div>
        </div>
      </div>
    );
  },
);
