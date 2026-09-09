"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { savePassQr } from "./save-pass-qr";

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
  autoSave = true,
}: {
  /** Signed token the door scanner reads. */
  token: string;
  /** Printed pass number, shown under the heading. */
  passCode: string;
  /** Anchor the booking sheet scrolls to once the seat is booked. */
  id?: string;
  /**
   * Save the PNG once, unprompted, as soon as the panel appears — the panel
   * only ever mounts on a fresh booking, so this is "saved on register",
   * exactly as /register behaves.
   */
  autoSave?: boolean;
}) {
  const src = usePassQr(token);
  const saved = useRef(false);

  useEffect(() => {
    // ponytail: ref guard, not state — Strict Mode re-runs effects in dev and
    // would otherwise download twice.
    if (!autoSave || saved.current) return;
    saved.current = true;
    // Best-effort: in-app browsers (Messenger) can swallow this silently, which
    // is why the Save button and the lookup line below are always rendered.
    void savePassQr(token, passCode).catch(() => {});
  }, [autoSave, token, passCode]);

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
          Save QR
        </button>
        <p className="pq-note">
          Saved to your downloads. If it did not save, tap Save QR — or{" "}
          <a className="pq-link" href="/passes">
            look it up
          </a>{" "}
          with your name and email.
        </p>
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
