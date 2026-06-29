import { forwardRef } from "react";

import { accentForType } from "./accent";
import { POSTER_H, POSTER_W, posterDate, posterInitials, posterVenue } from "./shared";
import type { EventPosterData } from "./types";

/** Framed — host photo (uncropped, contain) inside a white-bordered card centered
 *  on the accent-gradient background, with the title and details beneath. */
export const FramedPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function FramedPoster({ data }, ref) {
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
          background: `linear-gradient(155deg, ${ac.accent}, ${ac.deep})`,
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "20px 22px 18px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2.5 }}>GEMA</div>
          <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 20, padding: "4px 10px" }}>
            {ac.label}
          </div>
        </div>

        {/* Framed photo */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              padding: 8,
              boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "flex",
            }}
          >
            <div
              style={{
                width: 232,
                height: 232,
                borderRadius: 8,
                overflow: "hidden",
                background: ac.soft,
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
                  style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block" }}
                />
              ) : (
                <span style={{ fontSize: 80, fontWeight: 900, color: ac.accent }}>
                  {posterInitials(data.speakerName)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          {data.speakerName ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
              ✦ {data.speakerName}
            </div>
          ) : null}
          <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.14, textTransform: "uppercase", letterSpacing: -0.4, wordBreak: "break-word" }}>
            {data.title || "Your Event Title"}
          </div>
          <div style={{ marginTop: 9, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
            {date.hasDate ? `${date.day} ${date.month} · ${date.dow} · ${date.time}` : "Date & time TBA"}
          </div>
          <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {venue}
          </div>
        </div>
      </div>
    );
  },
);
