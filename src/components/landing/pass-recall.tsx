"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";

import { issuePassQrToken } from "@/lib/actions/pass-token";
import {
  forgetBookedPass,
  passLookupHref,
  readBookedPass,
  type BookedPass,
} from "@/lib/events/booked-pass";

import "./pass-recall.css";

/**
 * "Already booked? Find my pass."
 *
 * The pass and its QR used to live only inside the booking sheet — dismiss it,
 * or come back tomorrow, and there was no way back to the QR from the landing
 * at all. /passes could always find it, but nothing on the page said so.
 *
 * Two states, one component:
 *   * We remember a booking on this device -> name the pass code and download
 *     the QR in one tap.
 *   * We do not -> a plain link to the lookup, which still works from any device
 *     with a name plus the email or mobile they used.
 *
 * The download asks the server to re-issue the token rather than reading one
 * from storage. Nothing that gets somebody through the door is kept in this
 * browser, so a shared phone cannot hand the next person the previous guest's
 * pass — and "Not you?" clears the breadcrumb outright.
 *
 * Rendered after mount only: localStorage does not exist on the server, and a
 * server-rendered "not booked" swapping to "booked" is a hydration mismatch.
 */
export function PassRecall({ eventId }: { eventId: string }) {
  const [pass, setPass] = useState<BookedPass | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPass(readBookedPass(eventId));
    setReady(true);
  }, [eventId]);

  const download = () => {
    if (!pass || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await issuePassQrToken({
        passCode: pass.passCode,
        name: pass.name,
        contact: pass.contact,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await savePassPng(result.token, result.passCode);
    });
  };

  const forget = () => {
    forgetBookedPass(eventId);
    setPass(null);
    setError(null);
  };

  if (!ready) return null;

  return (
    <div className={"pr-strip" + (pass ? " pr-strip--known" : "")}>
      {pass ? (
        <>
          <div className="pr-copy">
            <span className="pr-eyebrow">Your pass</span>
            <b>{pass.passCode}</b>
            <em>{pass.name}</em>
            {error ? (
              <em className="pr-error" role="alert">
                {error}{" "}
                <a className="pr-inline" href={passLookupHref(pass)}>
                  Open the lookup
                </a>
              </em>
            ) : (
              <button type="button" className="pr-inline pr-forget" onClick={forget}>
                Not you?
              </button>
            )}
          </div>
          <button type="button" className="pr-link" onClick={download} disabled={pending}>
            {pending ? "Getting your QR…" : "Download QR"}
          </button>
        </>
      ) : (
        <>
          <div className="pr-copy">
            <span className="pr-eyebrow">Already booked?</span>
            <em>Look up your pass with your name and the email or mobile you used.</em>
          </div>
          <a className="pr-link" href={passLookupHref(null)}>
            Find my pass
          </a>
        </>
      )}
    </div>
  );
}

/** Print-size PNG. Blob, not the data: URL — iOS Safari ignores `download` on data:. */
async function savePassPng(token: string, passCode: string) {
  try {
    const png = await QRCode.toDataURL(token, { width: 1024, margin: 2 });
    const href = URL.createObjectURL(await (await fetch(png)).blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = `Ginhawa-pass-${passCode.replace(/\s+/g, "")}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    // In-app browsers swallow downloads. The lookup page is the way through.
  }
}
