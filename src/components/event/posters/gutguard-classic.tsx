import { forwardRef } from "react";

import { accentForType } from "./accent";
import { GemaWordmark } from "./gema-wordmark";
import { hostPhotoStyle, POSTER_H, POSTER_W, posterDate, posterInitials, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/**
 * Gutguard Classic — recreation of the prototype's light event poster: silver
 * radial background, a chunky outlined title with a 3-D shadow (system fonts),
 * a white-framed host photo, and the GEMA wordmark. Title/accents follow the
 * event-type colour.
 */
export const GutguardClassicPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function GutguardClassicPoster({ data }, ref) {
    const ac = accentForType(data.eventType);
    const date = posterDate(data.startsAt);
    const venue = posterVenue(data);

    const titleShadow = `0 1px 0 ${ac.deep}, 0 2px 0 ${ac.deep}, 0 3px 0 ${ac.deep}, 0 5px 9px rgba(0,30,90,0.3)`;

    return (
      <div
        ref={ref}
        style={{
          width: POSTER_W,
          height: POSTER_H,
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 50% 34%, #fdfdfd 0%, #f2f2f2 32%, #dadada 68%, #c4c4c4 100%)",
          color: "#1d1d1f",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "20px 22px 18px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <GemaWordmark height={22} color={ac.deep} />
        <div style={{ marginTop: 8, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.4, color: "#1d1d1f" }}>
          RADIATING WELLNESS · TRANSFORMING LIVES
        </div>

        {/* Title */}
        <div
          style={{
            marginTop: 12,
            fontSize: 30,
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: -0.5,
            textTransform: "uppercase",
            color: ac.accent,
            WebkitTextStroke: "1px #ffffff",
            textShadow: titleShadow,
            wordBreak: "break-word",
          }}
        >
          {data.title || "Your Event Title"}
        </div>

        {/* Framed photo */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, marginTop: 12 }}>
          <div style={{ background: "#ffffff", borderRadius: 6, padding: 6, boxShadow: "0 10px 26px rgba(20,40,80,0.22)" }}>
            <div style={{ width: 158, height: 178, overflow: "hidden", background: "#eef1f6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}>
              {data.speakerPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.speakerPhotoUrl}
                  alt={data.speakerName ?? "Speaker"}
                  crossOrigin="anonymous"
                  style={hostPhotoStyle(data.photoFocus)}
                />
              ) : (
                <span style={{ fontSize: 64, fontWeight: 900, color: ac.accent }}>
                  {posterInitials(data.speakerName)}
                </span>
              )}
            </div>
          </div>
        </div>

        {data.speakerName ? (
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, color: "#15233e", letterSpacing: 0.2 }}>
            {data.speakerName}
          </div>
        ) : null}

        {/* Date */}
        <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900, color: ac.accent, letterSpacing: 0.3 }}>
          {date.hasDate ? `${date.month} ${date.day}` : "DATE TBA"}
        </div>
        <div style={{ marginTop: 1, fontSize: 11, fontWeight: 700, color: "#33425c" }}>
          {date.hasDate ? `${date.dow} · ${date.time}` : ""}
        </div>

        {/* Venue */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, maxWidth: "100%" }}>
          <span style={{ color: ac.accent, fontSize: 11 }}>▲</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#33425c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {venue.toUpperCase()}
          </span>
        </div>
      </div>
    );
  },
);
