export type VideoEmbed = { kind: "drive" | "file"; src: string };

/** Turns a Drive share link into an embed URL; other https URLs play as <video>. */
export function resolveVideo(url: string | null | undefined): VideoEmbed | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const fileId =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  if (fileId && /(?:drive|docs)\.google\.com/i.test(trimmed)) {
    return { kind: "drive", src: `https://drive.google.com/file/d/${fileId}/preview` };
  }
  return { kind: "file", src: trimmed };
}
