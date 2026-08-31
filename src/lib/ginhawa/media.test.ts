import assert from "node:assert/strict";
import test from "node:test";

import { cleanMedia, landingMedia, landingSlides, resolveMedia } from "./media.ts";

test("Drive share links become an embed; other URLs pick a kind from the path", () => {
  assert.deepEqual(resolveMedia("https://drive.google.com/file/d/AbC_123/view"), {
    kind: "drive",
    src: "https://drive.google.com/file/d/AbC_123/preview",
    caption: "",
  });
  assert.equal(resolveMedia("https://cdn.example.com/clip.mp4")?.kind, "video");
  assert.equal(resolveMedia("https://cdn.example.com/poster.JPG?v=2")?.kind, "image");
  assert.equal(resolveMedia("  "), null);
});

test("a stored kind beats the extension sniff", () => {
  // The bug this fixes: an uploaded image on a URL with no extension used to
  // fall through to "video" and render inside a broken <video>.
  const extensionless = { url: "https://cdn.example.com/objects/abc123", caption: "" };
  assert.equal(resolveMedia(extensionless)?.kind, "video", "sniff still guesses video");
  assert.equal(resolveMedia({ ...extensionless, kind: "image" })?.kind, "image");

  // And it wins even when the extension actively disagrees.
  assert.equal(
    resolveMedia({ url: "https://cdn.example.com/thumb.jpg", caption: "", kind: "video" })?.kind,
    "video",
  );
});

test("a video carries its poster through to render", () => {
  const embed = resolveMedia({
    url: "https://cdn.example.com/clip.mp4",
    caption: "Meet them",
    kind: "video",
    poster: " https://cdn.example.com/clip.jpg ",
  });
  assert.equal(embed?.poster, "https://cdn.example.com/clip.jpg");
  // A blank poster must be absent, not an empty string — <video poster=""> is a broken request.
  assert.equal(resolveMedia({ url: "https://a.com/1.mp4", caption: "", poster: "  " })?.poster, undefined);
});

test("cleanMedia drops blank rows, keeps kind/poster, and caps the list at three", () => {
  const kept = cleanMedia([
    { url: " https://a.com/1.mp4 ", caption: " one ", kind: "video", poster: " https://a.com/1.jpg " },
    { url: "", caption: "dropped" },
    { url: "https://a.com/2.mp4", caption: "" },
    { url: "https://a.com/3.mp4", caption: "" },
    { url: "https://a.com/4.mp4", caption: "" },
  ]);
  assert.equal(kept.length, 3);
  assert.deepEqual(kept[0], {
    url: "https://a.com/1.mp4",
    caption: "one",
    kind: "video",
    poster: "https://a.com/1.jpg",
  });
  // No empty keys on rows that never had them.
  assert.deepEqual(kept[1], { url: "https://a.com/2.mp4", caption: "" });
  assert.deepEqual(cleanMedia(null), []);
});

test("a landing saved before the carousel still shows its single video", () => {
  const legacy = {
    media: [],
    videoUrl: "https://cdn.example.com/old.mp4",
    videoCaption: "Meet the clinicians",
  };
  assert.deepEqual(landingMedia(legacy), [
    { url: "https://cdn.example.com/old.mp4", caption: "Meet the clinicians" },
  ]);
  assert.equal(landingSlides(legacy).length, 1);

  // Once media is set it wins outright — the legacy column is not a second slide.
  const migrated = { ...legacy, media: [{ url: "https://cdn.example.com/new.mp4", caption: "" }] };
  assert.deepEqual(landingMedia(migrated), migrated.media);
});
