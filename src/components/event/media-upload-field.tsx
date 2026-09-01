"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import type { UploadedMedia } from "@/lib/storage/event-media";
import { MAX_EVENT_MEDIA_BYTES, uploadEventMedia } from "@/lib/storage/event-media";
import { Button } from "@/components/ui/button";

/**
 * Upload button for one carousel slide.
 *
 * Uploading is the path we want hosts on: the file lands in our own public
 * bucket, so playback never depends on a Google Drive share setting, and a
 * poster frame is captured on the way through. Pasting a URL still works for
 * anyone who already hosts their video somewhere.
 */
export function MediaUploadField({
  onUploaded,
  poster,
}: {
  onUploaded: (media: UploadedMedia) => void;
  /** Nullable: the form value comes straight from the stored slide. */
  poster?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    const result = await uploadEventMedia(file);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUploaded(result.data);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload aria-hidden="true" />
          )}
          {busy ? "Uploading…" : "Upload file"}
        </Button>
        <p className="text-xs font-semibold text-muted-foreground">
          MP4, WebM, MOV, or an image · up to{" "}
          {Math.floor(MAX_EVENT_MEDIA_BYTES / 1024 / 1024)} MB
        </p>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-10 w-16 rounded border border-border object-cover"
          />
        ) : null}
      </div>
      {error ? <p className="text-xs font-bold text-destructive">{error}</p> : null}
    </div>
  );
}
