import QRCode from "qrcode";

/**
 * Save a pass QR at print size.
 *
 * Its own module, not `pass-qr.tsx`: the booking sheet on the Sizzle and
 * Session templates saves the same file without ever rendering the pass panel,
 * and importing the component would drag `pass-qr.css` onto those pages.
 *
 * Same mechanics as the QRCodeCard on /register — one PNG, blob href, print
 * width — so a pass saved from a landing and one saved from the registration
 * page are the same file.
 */
export async function savePassQr(token: string, passCode: string) {
  // Blob, not the data: URL — iOS Safari won't honour `download` on data:.
  const png = await QRCode.toDataURL(token, { width: 1024, margin: 2 });
  const href = URL.createObjectURL(await (await fetch(png)).blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = `Ginhawa-pass-${passCode.replace(/\s+/g, "")}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
