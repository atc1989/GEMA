"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type QRCodeCardProps = {
  /** The value encoded into the QR image (the signed registration token). */
  value: string;
  /** Human-friendly confirmation/pass code shown below the QR. */
  code: string;
  title?: string;
  description?: string;
  /** Base filename for the saved PNG, without extension. */
  fileName?: string;
  /** Save the PNG once, unprompted, as soon as the card mounts. */
  autoSave?: boolean;
  className?: string;
};

/**
 * Renders a real, scannable QR for a registration plus its confirmation code.
 * The QR image is generated in the browser from `value`.
 */
export function QRCodeCard({
  value,
  code,
  title = "Your event pass",
  description,
  fileName,
  autoSave = false,
  className,
}: QRCodeCardProps) {
  const [src, setSrc] = useState<string | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  const save = async () => {
    // Blob, not the data: URL — iOS Safari won't honour `download` on data:.
    const png = await QRCode.toDataURL(value, { width: 1024, margin: 2 });
    const href = URL.createObjectURL(await (await fetch(png)).blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = `${fileName ?? `GEMA-pass-${code}`}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  useEffect(() => {
    // ponytail: ref guard, not state — Strict Mode re-runs effects in dev and
    // would otherwise download twice.
    if (!autoSave || saved.current) return;
    saved.current = true;
    // Best-effort: in-app browsers (Messenger) can swallow this silently, which
    // is why the Save button below is always rendered.
    void save().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, value]);

  return (
    <Card className={cn("p-5 text-center", className)}>
      <div className="mx-auto flex size-44 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Registration QR code" className="size-full" />
        ) : (
          <div className="size-full animate-pulse rounded-xl bg-muted" />
        )}
      </div>
      <h2 className="mt-4 text-sm font-black tracking-tight">{title}</h2>
      <div className="mt-1 font-mono text-sm font-bold tracking-wider text-foreground">
        {code}
      </div>
      {description ? (
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-success">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Ready for QR check-in
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={() => void save().catch(() => {})}
      >
        <Download aria-hidden="true" />
        Save QR
      </Button>
    </Card>
  );
}
