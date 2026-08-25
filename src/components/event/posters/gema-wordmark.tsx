import { GEMA_SVG } from "./gema-wordmark-data";

/** viewBox="-18 -18 1099 452" */
const WORDMARK_VB_W = 1099;
const WORDMARK_VB_H = 452;

/**
 * Recolorable GEMA wordmark. The SVG's viewBox is 1099×452; without a sized
 * containment box that intrinsic width leaks into grid/flex min-content and
 * collapses the Event banner column into a sliver on the right.
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
    `<svg width="100%" height="100%" preserveAspectRatio="xMinYMid meet" style="display:block;width:100%;height:100%;max-width:100%;max-height:100%" `,
  ).replaceAll('fill="#ffffff"', `fill="${color}"`);

  return (
    <span
      aria-label="GEMA"
      role="img"
      style={{
        display: "block",
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: `${width}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxHeight: `${height}px`,
        overflow: "hidden",
        contain: "size layout",
        flexShrink: 0,
        lineHeight: 0,
        position: "relative",
      }}
    >
      <span
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </span>
  );
}
