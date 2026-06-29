import { GEMA_SVG } from "./gema-wordmark-data";

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
  const svg = GEMA_SVG.replace("<svg ", `<svg height="${height}" `).replaceAll(
    'fill="#ffffff"',
    `fill="${color}"`,
  );
  return (
    <span
      aria-label="GEMA"
      role="img"
      style={{ display: "inline-flex", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
