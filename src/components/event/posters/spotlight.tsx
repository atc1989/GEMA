import { forwardRef } from "react";

import { accentForType } from "./accent";
import { hostPhotoStyle, POSTER_H, POSTER_W, posterDate, posterInitials, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Spotlight — speaker photo as the hero (falls back to a large monogram), with
 *  the title and details on a dark panel beneath. */
export const SpotlightPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function SpotlightPoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);
    const photoH = 248;

    return (
      <div
        ref={ref}
        style={{
          width: POSTER_W,
          height: POSTER_H,
          position: "relative",
          overflow: "hidden",
          background: ac.deep,
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Photo / monogram hero — uncropped (contain) on an accent-gradient letterbox */}
        <div
          style={{
            position: "relative",
            height: photoH,
            flexShrink: 0,
            overflow: "hidden",
            background: `linear-gradient(150deg, ${ac.accent}, ${ac.deep})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {data.speakerPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.speakerPhotoUrl}
              alt={data.speakerName ?? "Speaker"}
              crossOrigin="anonymous"
              style={hostPhotoStyle(data.photoFocus)}
            />
          ) : (
            <span style={{ fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>
              {posterInitials(data.speakerName)}
            </span>
          )}
          {/* bottom fade for legibility */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 60%, ${ac.deep} 100%)` }} />
          {/* type tag */}
          <div style={{ position: "absolute", top: 16, left: 16, fontSize: 8.5, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", background: ac.accent, borderRadius: 20, padding: "5px 11px" }}>
            {ac.label}
          </div>
          {/* brand */}
          <div style={{ position: "absolute", top: 16, right: 16, fontSize: 12, fontWeight: 900, letterSpacing: 2, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
            GEMA
          </div>
        </div>

        {/* Details panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 22px 18px" }}>
          {data.speakerName ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: ac.accent, marginBottom: 6 }}>
              ✦ {data.speakerName}
            </div>
          ) : null}

          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.12, textTransform: "uppercase", letterSpacing: -0.5, wordBreak: "break-word" }}>
              {data.title || "Your Event Title"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            {date.hasDate ? (
              <>
                <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: ac.accent }}>{date.day}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{date.month}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{date.dow} · {date.time}</div>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>Date & time TBA</span>
            )}
            <span style={{ marginLeft: "auto", maxWidth: 150, textAlign: "right", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {venue}
            </span>
          </div>
        </div>
      </div>
    );
  },
);
