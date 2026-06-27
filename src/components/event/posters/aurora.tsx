import { forwardRef } from "react";

import { accentForType } from "./accent";
import { POSTER_H, POSTER_W, posterDate, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Aurora — navy/accent gradient with soft blobs (the original design, now
 *  auto-tinted by event type). */
export const AuroraPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function AuroraPoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);
    const venueIcon = data.mode === "online" ? "◉" : "▲";

    return (
      <div
        ref={ref}
        style={{
          width: POSTER_W,
          height: POSTER_H,
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(145deg, ${ac.accent} 0%, ${ac.deep} 60%, #07172b 100%)`,
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "24px 22px 18px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "absolute", top: -70, right: -70, width: 230, height: 230, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 190, height: 190, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: 160, left: -25, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{ width: 30, height: 30, flexShrink: 0, background: "rgba(255,255,255,0.12)", borderRadius: "6px 6px 12px 12px", border: "1.5px solid #f5b716", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>
            G
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>GEMA</div>
            <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginTop: 1 }}>GROUP EVENT MANAGEMENT APP</div>
          </div>
        </div>

        <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: 10 }}>
          {ac.label}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.18, textTransform: "uppercase", letterSpacing: -0.3, wordBreak: "break-word" }}>
            {data.title || "Your Event Title"}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.18)", margin: "14px 0" }} />

        {date.hasDate ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{date.day}</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{date.month}</span>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.65)", marginTop: 3, letterSpacing: 0.5 }}>
              {date.dow} · {date.time}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Date & time TBA</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
          <span style={{ fontSize: 10 }}>{venueIcon}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{venue}</span>
        </div>

        {data.speakerName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
            <span style={{ fontSize: 10 }}>✦</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.speakerName}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.13)", fontSize: 7.5, color: "rgba(255,255,255,0.4)", fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase" }}>
          RADIATING WELLNESS · TRANSFORMING LIVES
        </div>
      </div>
    );
  },
);
