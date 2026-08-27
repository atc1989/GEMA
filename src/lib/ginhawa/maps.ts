/** Turn a Google Maps share/place URL into an embeddable iframe src. */
export function mapsEmbedSrc(
  mapUrl: string | null,
  address: string | null,
  name: string | null,
): string | null {
  if (mapUrl) {
    if (/google\.[^/]+\/maps\/embed/i.test(mapUrl)) return mapUrl;
    const ll = mapUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (ll) {
      return `https://maps.google.com/maps?q=${ll[1]},${ll[2]}&z=17&hl=en&output=embed`;
    }
    const at = mapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) {
      return `https://maps.google.com/maps?q=${at[1]},${at[2]}&z=17&hl=en&output=embed`;
    }
    try {
      const q = new URL(mapUrl).searchParams.get("q");
      if (q) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=17&hl=en&output=embed`;
      }
    } catch {
      /* ignore invalid URLs */
    }
  }
  const query = address || name;
  if (!query) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&hl=en&output=embed`;
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
