"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

type QrDownloadProps = {
  /** Path appended to the current origin, e.g. `/invite/abc123`. */
  path: string;
  /** Base filename for downloads, without extension. */
  fileName: string;
  className?: string;
};

/**
 * QR preview for a shareable URL with copy link + PNG/SVG downloads.
 * Horizontal on ≥sm screens, stacked and centered on mobile.
 * Unstyled beyond its own block — callers wrap it in a Card if needed.
 */
export function QrDownload({ path, fileName, className }: QrDownloadProps) {
  const [url, setUrl] = useState("");
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setUrl(window.location.origin + path);
  }, [path]);

  useEffect(() => {
    if (!url) return;
    let active = true;
    QRCode.toDataURL(url, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then((s) => {
        if (active) setSrc(s);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const download = async (format: "png" | "svg") => {
    if (!url) return;
    const href =
      format === "png"
        ? await QRCode.toDataURL(url, { width: 1024, margin: 2 })
        : URL.createObjectURL(
            new Blob([await QRCode.toString(url, { type: "svg", margin: 2 })], {
              type: "image/svg+xml",
            }),
          );
    const a = document.createElement("a");
    a.href = href;
    a.download = `${fileName}.${format}`;
    a.click();
    if (format === "svg") URL.revokeObjectURL(href);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code for ${url}`} className="size-full" />
        ) : (
          <div className="size-full animate-pulse rounded-xl bg-muted" />
        )}
      </div>

      <div className="grid w-full min-w-0 flex-1 gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
          </div>
          <CopyButton value={url} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => download("png")}>
            <Download aria-hidden="true" />
            PNG
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => download("svg")}>
            <Download aria-hidden="true" />
            SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
