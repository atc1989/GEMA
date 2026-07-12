"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QrDownloadProps = {
  /** Path appended to the current origin, e.g. `/invite/abc123`. */
  path: string;
  /** Base filename for downloads, without extension. */
  fileName: string;
  className?: string;
};

/**
 * QR preview for a shareable URL with PNG/SVG download buttons.
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
    <div className={cn("grid justify-items-center gap-3", className)}>
      <div className="flex size-44 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code for ${url}`} className="size-full" />
        ) : (
          <div className="size-full animate-pulse rounded-xl bg-muted" />
        )}
      </div>
      <p className="max-w-full truncate font-mono text-xs text-muted-foreground">{url}</p>
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
  );
}
