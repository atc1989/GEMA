import { GEMA_SVG } from "./gema-wordmark-data";

/** viewBox="-18 -18 1099 452" — keep width/height in lockstep so the SVG cannot
 *  expand to its 1099×452 intrinsic size and blow out the poster canvas. */
const WORDMARK_VB_W = 1099;
const WORDMARK_VB_H = 452;

/**
 * The prototype's "gema" wordmark, recolorable + sized. Renders the verbatim SVG
 * (fills swapped to the chosen color) at a given height. Works in both server and
 * client components and exports cleanly via html-to-image.
 */
export function GemaWordmark({
  height = 16,
  color = "#ffffff",
}: {
  height?: number;
  color?: string;
}) {
  const width = Math.round(((height * WORDMARK_VB_W) / WORDMARK_VB_H) * 100) / 100;
  const svg = GEMA_SVG.replace(
    "<svg ",
    `<svg width="${width}" height="${height}" style="width:${width}px;height:${height}px;max-width:none;display:block;overflow:hidden" `,
  ).replaceAll('fill="#ffffff"', `fill="${color}"`);
  return (
    <span
      aria-label="GEMA"
      role="img"
      style={{
        display: "block",
        width,
        height,
        overflow: "hidden",
        flexShrink: 0,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
