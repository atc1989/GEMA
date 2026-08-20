"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Public Storage bucket for speaker photos and custom event banners. */
export const EVENT_PHOTOS_BUCKET = "event-photos";
export const MAX_EVENT_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateEventPhoto(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose a PNG or JPG image.";
  if (file.size > MAX_EVENT_PHOTO_BYTES) return "Image must be under 5 MB.";
  return null;
}

export async function uploadEventPhoto(
  file: File,
  folder: "speakers" | "banners",
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const invalid = validateEventPhoto(file);
  if (invalid) return { ok: false, error: invalid };

  try {
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(EVENT_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) return { ok: false, error: "Upload failed. Try again." };

    const { data } = supabase.storage.from(EVENT_PHOTOS_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch {
    return { ok: false, error: "Upload failed. Try again." };
  }
}
