import assert from "node:assert/strict";
import test from "node:test";

import { mapsCid, mapsEmbedSrc, mapsPlaceName } from "./maps.ts";

// A share URL of the shape Google hands out for a business listing.
const PLACE_URL =
  "https://www.google.com/maps/place/Gutguard+Academy/@7.075543,125.612137,17z/" +
  "data=!3m1!4b1!4m6!3m5!1s0x32f96d9b0f0a0a0b:0x6defe0206e50de0e!8m2!3d7.075543!4d125.612137!16s%2Fg%2F11abc";

test("a place URL embeds by CID, so the map opens the same listing as the link", () => {
  // The bug this fixes: the embed used the `!3d/!4d` pair, so clicking the map
  // opened 7°04'32.0\"N 125°36'43.7\"E while the button opened the business.
  assert.equal(mapsCid(PLACE_URL), "7921796699462360590");
  const src = mapsEmbedSrc(PLACE_URL, "Davao City", "Gutguard Academy");
  assert.match(src ?? "", /[?&]cid=7921796699462360590(&|$)/);
  assert.doesNotMatch(src ?? "", /7\.075543/);
  assert.match(src ?? "", /output=embed/);
});

test("CID is read from every shape that carries it, and never as zero", () => {
  assert.equal(mapsCid("https://maps.google.com/?cid=7921796699462360590"), "7921796699462360590");
  assert.equal(mapsCid("https://www.google.com/maps?ftid=0x32f9:0x6defe0206e50de0e"), "7921796699462360590");
  assert.equal(mapsCid("https://www.google.com/maps/place/Somewhere/@1.0,2.0,17z"), null);
  assert.equal(mapsCid("https://maps.google.com/?cid=0"), null);
  assert.equal(mapsCid("https://www.google.com/maps?ftid=0x32f9:0x0"), null);
});

test("without a CID the query names the place instead of dropping a pin", () => {
  const noCid = "https://www.google.com/maps/place/Gutguard+Academy/@7.075543,125.612137,17z";
  assert.equal(mapsPlaceName(noCid), "Gutguard Academy");
  assert.match(
    mapsEmbedSrc(noCid, "Quimpo Blvd, Davao City", null) ?? "",
    /q=Gutguard%20Academy%2C%20Quimpo%20Blvd%2C%20Davao%20City/,
  );

  // `place_id:` is inert on the keyless endpoint, so it must not become the query.
  const placeIdUrl = "https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4";
  const src = mapsEmbedSrc(placeIdUrl, "Quimpo Blvd", "Gutguard Academy");
  assert.doesNotMatch(src ?? "", /place_id/);
  assert.match(src ?? "", /q=Gutguard%20Academy%2C%20Quimpo%20Blvd/);
});

test("coordinates stay the last resort, and an embed URL passes through", () => {
  // Nothing names this one, so a pin beats no map at all.
  assert.match(
    mapsEmbedSrc("https://www.google.com/maps/@7.075543,125.612137,17z", null, null) ?? "",
    /q=7\.075543,125\.612137/,
  );

  const alreadyEmbed = "https://www.google.com/maps/embed?pb=!1m18!1m12";
  assert.equal(mapsEmbedSrc(alreadyEmbed, "Davao", "Gutguard Academy"), alreadyEmbed);

  assert.equal(mapsEmbedSrc(null, null, null), null);
  assert.match(mapsEmbedSrc(null, null, "Gutguard Academy") ?? "", /q=Gutguard%20Academy/);
  // An address that already contains the name is not repeated back to Google.
  assert.match(
    mapsEmbedSrc(null, "Gutguard Academy, Davao City", "Gutguard Academy") ?? "",
    /q=Gutguard%20Academy%2C%20Davao%20City&/,
  );
});
