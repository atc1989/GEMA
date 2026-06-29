import { forwardRef } from "react";

import { accentForType } from "./accent";
import { hostPhotoStyle, POSTER_H, POSTER_W, posterDate, posterInitials, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Postcard — full host photo (uncropped, contain) on top, oversized title block
 *  filling the bottom. Bold and editorial. */
export const PostcardPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function PostcardPoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);
    const photoH = 230;

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
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Photo top — accent-gradient letterbox, contained image */}
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
            <span style={{ fontSize: 88, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>
              {posterInitials(data.speakerName)}
            </span>
          )}
          <div style={{ position: "absolute", top: 14, left: 14, fontSize: 12, fontWeight: 900, letterSpacing: 2, textShadow: "0 1px 4px rgba(0,0,0,0.45)" }}>
            GEMA
          </div>
          <div style={{ position: "absolute", top: 14, right: 14, fontSize: 8.5, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", background: "rgba(0,0,0,0.28)", borderRadius: 20, padding: "5px 11px" }}>
            {ac.label}
          </div>
        </div>

        {/* Title block */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 22px 20px", background: ac.accent }}>
          {data.speakerName ? (
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
              ✦ {data.speakerName}
            </div>
          ) : null}

          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.0, textTransform: "uppercase", letterSpacing: -1, wordBreak: "break-word" }}>
              {data.title || "Your Event Title"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>
                {date.hasDate ? `${date.day} ${date.month}` : "Date TBA"}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                {date.hasDate ? `${date.dow} · ${date.time}` : ""}
              </div>
            </div>
            <span style={{ marginLeft: "auto", maxWidth: 160, textAlign: "right", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {venue}
            </span>
          </div>
        </div>
      </div>
    );
  },
);
