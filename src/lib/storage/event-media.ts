"use client";

import type { MediaKind } from "@/lib/ginhawa/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Public Storage bucket for landing carousel media. See supabase/event_media_storage.sql. */
export const EVENT_MEDIA_BUCKET = "event-media";

/** Mirrors the bucket's file_size_limit so the user hears about it before the upload. */
export const MAX_EVENT_MEDIA_BYTES = 50 * 1024 * 1024;

/** Mirrors the bucket's allowed_mime_types. Storage re-checks both server-side. */
const ALLOWED = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadedMedia = { url: string; kind: MediaKind; poster?: string };

export function validateEventMedia(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return "Use an MP4, WebM, or MOV video, or a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_EVENT_MEDIA_BYTES) {
    return `File must be under ${Math.floor(MAX_EVENT_MEDIA_BYTES / 1024 / 1024)} MB.`;
  }
  return null;
}

function storagePath(file: File, ext: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${file.type.startsWith("video/") ? "video" : "image"}/${stamp}.${ext}`;
}

/**
 * Grabs a still from the video for use as the <video poster>.
 *
 * Runs entirely in the browser against a local object URL — no transcoding
 * service, and the file never round-trips. Returns null on any failure
 * (codec the canvas cannot paint, metadata that never loads); the caller
 * treats a poster as optional, so a miss costs a black first frame, not
 * a failed upload.
 */
async function posterFromVideo(file: File): Promise<Blob | null> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      // ponytail: 10s ceiling — a video that has not produced one frame by then
      // is not going to, and the host should not wait on it.
      const timer = setTimeout(() => reject(new Error("timeout")), 10_000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onseeked = done;
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("decode"));
      };
      video.onloadeddata = () => {
        // A frame at 0s is often black; a moment in is a better thumbnail.
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      };
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
  }
}

/**
 * Uploads one carousel slide and returns what the landing should store.
 * Videos get a poster frame when one can be captured.
 */
export async function uploadEventMedia(
  file: File,
): Promise<{ ok: true; data: UploadedMedia } | { ok: false; error: string }> {
  const invalid = validateEventMedia(file);
  if (invalid) return { ok: false, error: invalid };

  try {
    const supabase = createSupabaseBrowserClient();
    const bucket = supabase.storage.from(EVENT_MEDIA_BUCKET);
    const isVideo = file.type.startsWith("video/");
    const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");

    const path = storagePath(file, ext);
    const { error } = await bucket.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) return { ok: false, error: "Upload failed. Try again." };

    const data: UploadedMedia = {
      url: bucket.getPublicUrl(path).data.publicUrl,
      kind: isVideo ? "video" : "image",
    };

    if (isVideo) {
      const poster = await posterFromVideo(file);
      if (poster) {
        const posterPath = `poster/${path.split("/").pop()?.replace(/\.[^.]+$/, "")}.jpg`;
        const { error: posterError } = await bucket.upload(posterPath, poster, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (!posterError) data.poster = bucket.getPublicUrl(posterPath).data.publicUrl;
      }
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: "Upload failed. Try again." };
  }
}
