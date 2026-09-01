"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import "./pass-qr.css";

/** One data URL per token per page: the card face and the panel show one QR. */
const cache = new Map<string, string>();

/** Screen-sized QR for a pass token, or null until it is drawn. */
export function usePassQr(token: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (token ? cache.get(token) ?? null : null));

  useEffect(() => {
    if (!token) {
      setSrc(null);
      return;
    }
    const drawn = cache.get(token);
    if (drawn) {
      setSrc(drawn);
      return;
    }
    let alive = true;
    QRCode.toDataURL(token, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        cache.set(token, url);
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return src;
}

/** Save the pass QR at print size. */
async function savePassQr(token: string, passCode: string) {
  // Blob, not the data: URL — iOS Safari won't honour `download` on data:.
  const png = await QRCode.toDataURL(token, { width: 1024, margin: 2 });
  const href = URL.createObjectURL(await (await fetch(png)).blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = `Ginhawa-pass-${passCode.replace(/\s+/g, "")}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/**
 * The guest's pass, sitting under their Lifestyle Card.
 *
 * It used to live inside the booking sheet, which meant the QR went away with
 * the sheet. On the page it stays: the card says whose pass it is, this says
 * what to do with it, and the door scans the same token either way.
 */
export function PassQr({
  token,
  passCode,
  id,
}: {
  /** Signed token the door scanner reads. */
  token: string;
  /** Printed pass number, shown under the heading. */
  passCode: string;
  /** Anchor the booking sheet scrolls to once the seat is booked. */
  id?: string;
}) {
  const src = usePassQr(token);

  return (
    <div className="pq" id={id}>
      <div className="pq-left">
        <p className="pq-eyebrow">Your Ginhawa Pass</p>
        <b className="pq-title">Show this at the door</b>
        <em className="pq-code">{passCode}</em>
        <button
          type="button"
          className="pq-btn"
          disabled={!src}
          onClick={() => void savePassQr(token, passCode).catch(() => {})}
        >
          Download QR
        </button>
      </div>
      <div className="pq-right">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Pass QR for ${passCode}`} width={220} height={220} />
        ) : (
          <span className="pq-wait" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
