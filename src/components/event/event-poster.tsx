"use client";

import { forwardRef, useRef, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type EventPosterData = {
  title: string;
  eventType?: string;
  mode: "in_person" | "online" | "hybrid";
  startsAt?: string;
  venueName?: string;
  speakerName?: string;
};

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAYS   = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

// Pure poster visual — rendered at 360×450, exported at 1080×1350 (pixelRatio 3).
export const EventPoster = forwardRef<HTMLDivElement, { data: EventPosterData }>(
  function EventPoster({ data }, ref) {
    const d = data.startsAt && !Number.isNaN(Date.parse(data.startsAt))
      ? new Date(data.startsAt)
      : null;

    const month   = d ? MONTHS[d.getMonth()] ?? "" : "";
    const day     = d ? d.getDate() : "";
    const dow     = d ? DAYS[d.getDay()] ?? "" : "";
    const time    = d
      ? d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
      : "";

    const venue = data.mode === "online"
      ? "Online Event"
      : data.venueName || "Venue TBA";

    const venueIcon = data.mode === "online" ? "◉" : "▲";

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          height: 450,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(145deg, #1f5d99 0%, #163f66 55%, #0a2440 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "24px 22px 18px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -70, right: -70, width: 230, height: 230, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 190, height: 190, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 160, left: -25, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 60, right: 30, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{
            width: 30, height: 30, flexShrink: 0,
            background: "rgba(255,255,255,0.12)",
            borderRadius: "6px 6px 12px 12px",
            border: "1.5px solid #f5b716",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900,
          }}>
            G
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>GEMA</div>
            <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginTop: 1 }}>
              GROUP EVENT MANAGEMENT APP
            </div>
          </div>
        </div>

        {/* Eyebrow */}
        <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 3, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", marginBottom: 10 }}>
          GUTGUARD WELLNESS EVENT
        </div>

        {/* Title — flexible height */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.18, textTransform: "uppercase", letterSpacing: -0.3, wordBreak: "break-word" }}>
            {data.title || "Your Event Title"}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.18)", margin: "14px 0" }} />

        {/* Date */}
        {d ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{day}</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{month}</span>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.65)", marginTop: 3, letterSpacing: 0.5 }}>
              {dow} · {time}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
            Date & time TBA
          </div>
        )}

        {/* Venue */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
          <span style={{ fontSize: 10 }}>{venueIcon}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{venue}</span>
        </div>

        {/* Speaker */}
        {data.speakerName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
            <span style={{ fontSize: 10 }}>✦</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.speakerName}</span>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.13)", fontSize: 7.5, color: "rgba(255,255,255,0.4)", fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase" }}>
          RADIATING WELLNESS · TRANSFORMING LIVES
        </div>
      </div>
    );
  },
);

// Standalone download button — renders a hidden poster, captures, and downloads.
export function DownloadBannerButton({ data, label = "Download banner" }: { data: EventPosterData; label?: string }) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const { toPng } = await import("html-to-image");
      const node = hiddenRef.current;
      if (!node) return;
      try {
        const url = await toPng(node, { pixelRatio: 3, cacheBust: true });
        const a = document.createElement("a");
        a.download = `gema-event-banner.png`;
        a.href = url;
        a.click();
      } catch {
        // silent — user can retry
      }
    });
  };

  return (
    <>
      {/* Hidden poster for capture */}
      <div
        style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none", zIndex: -1 }}
        aria-hidden="true"
      >
        <EventPoster ref={hiddenRef} data={data} />
      </div>

      <Button type="button" variant="brand" onClick={handleDownload} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending ? "Rendering…" : label}
      </Button>
    </>
  );
}
