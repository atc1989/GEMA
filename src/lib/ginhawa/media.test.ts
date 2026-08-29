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

test("cleanMedia drops blank rows and caps the list at three", () => {
  const many = [
    { url: " https://a.com/1.mp4 ", caption: " one " },
    { url: "", caption: "dropped" },
    { url: "https://a.com/2.mp4", caption: "" },
    { url: "https://a.com/3.mp4", caption: "" },
    { url: "https://a.com/4.mp4", caption: "" },
  ];
  const kept = cleanMedia(many);
  assert.equal(kept.length, 3);
  assert.deepEqual(kept[0], { url: "https://a.com/1.mp4", caption: "one" });
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
