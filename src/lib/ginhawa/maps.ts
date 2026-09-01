/**
 * Google's keyless embed endpoint (`output=embed`) only names a business when
 * the query identifies one. A `!3d/!4d` coordinate pair drops an anonymous pin,
 * so the embed opens `7°04'32.0"N 125°36'43.7"E` while the "Open in Google Maps"
 * link beside it opens the venue's real listing — the two disagreeing is the bug
 * this file exists to avoid.
 *
 * What the endpoint accepts, tested against it:
 *   - `cid=<decimal>`  → the exact listing, same entity the share link opens.
 *   - `q=<name, address>` → resolves to the business, with its name and category.
 *   - `q=<lat>,<lng>`  → a nameless "fake latlng" pin. Last resort only.
 *   - `q=place_id:…`   → does NOT resolve here; that is the paid Embed API.
 */

const EMBED_TAIL = "&z=17&hl=en&output=embed";

function embed(query: string): string {
  return `https://maps.google.com/maps?${query}${EMBED_TAIL}`;
}

/**
 * Decimal CID for the listing a Google Maps URL points at.
 *
 * Share links carry it as the hex half after the colon in `!1s0x…:0x…` (inside
 * `data=`) or in `ftid=`; some carry `cid=` outright. It exceeds 2^53, so the
 * conversion goes through BigInt.
 */
export function mapsCid(mapUrl: string): string | null {
  const decimal = mapUrl.match(/[?&]cid=(\d+)/);
  if (decimal) return decimal[1] === "0" ? null : decimal[1];

  const hex = mapUrl.match(/(?:!1s|[?&]ftid=)0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (!hex) return null;
  try {
    // BigInt call, not a literal: the project targets ES2017.
    const cid = BigInt(`0x${hex[1]}`).toString(10);
    return cid === "0" ? null : cid;
  } catch {
    return null;
  }
}

/** The place name Google puts in the path: /maps/place/Gutguard+Academy/@… */
export function mapsPlaceName(mapUrl: string): string | null {
  const match = mapUrl.match(/\/maps\/place\/([^/@?#]+)/i);
  if (!match) return null;
  try {
    const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    // `/maps/place/` with no name segment, and coordinate-only paths.
    if (!name || /^data=/i.test(name) || /^-?\d+\.\d+,-?\d+\.\d+$/.test(name)) return null;
    return name;
  } catch {
    return null;
  }
}

/** `Name, Address` — whichever halves exist, without repeating one inside the other. */
function placeQuery(name: string | null, address: string | null): string | null {
  const n = name?.trim() || null;
  const a = address?.trim() || null;
  if (n && a) {
    return a.toLowerCase().includes(n.toLowerCase()) ? a : `${n}, ${a}`;
  }
  return n || a;
}

/** Turn a Google Maps share/place URL into an embeddable iframe src. */
export function mapsEmbedSrc(
  mapUrl: string | null,
  address: string | null,
  name: string | null,
): string | null {
  if (mapUrl) {
    if (/google\.[^/]+\/maps\/embed/i.test(mapUrl)) return mapUrl;

    // Exact listing: what the "Open in Google Maps" link opens.
    const cid = mapsCid(mapUrl);
    if (cid) return embed(`cid=${cid}`);

    // Named place: resolves to the business rather than to a bare pin.
    const named = placeQuery(mapsPlaceName(mapUrl) ?? name, address);
    if (named) return embed(`q=${encodeURIComponent(named)}`);

    try {
      const q = new URL(mapUrl).searchParams.get("q")?.trim();
      // `place_id:` is inert here, and a bare coordinate `q` is handled below.
      if (q && !/^place_id:/i.test(q)) {
        return embed(`q=${encodeURIComponent(q)}`);
      }
    } catch {
      /* ignore invalid URLs */
    }

    // Nothing names the place, so fall back to a pin rather than no map at all.
    const ll = mapUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? mapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (ll) return embed(`q=${ll[1]},${ll[2]}`);
  }

  const query = placeQuery(name, address);
  if (!query) return null;
  return embed(`q=${encodeURIComponent(query)}`);
}

/** Follow maps.app.goo.gl (and similar) short links to the place URL. */
export async function resolveGoogleMapsUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (!/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) return url;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0" },
    });
    return res.url || url;
  } catch {
    return url;
  }
}
