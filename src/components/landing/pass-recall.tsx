"use client";

import { useEffect, useState } from "react";

import {
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
 *   * We remember a booking on this device -> name the pass code and deep-link
 *     the lookup with their details already filled in.
 *   * We do not -> a plain link to the lookup, which still works from any device
 *     with a name plus the email or mobile they used.
 *
 * Rendered after mount only: localStorage does not exist on the server, and a
 * server-rendered "not booked" swapping to "booked" is a hydration mismatch.
 */
export function PassRecall({ eventId }: { eventId: string }) {
  const [pass, setPass] = useState<BookedPass | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPass(readBookedPass(eventId));
    setReady(true);
  }, [eventId]);

  if (!ready) return null;

  return (
    <div className={"pr-strip" + (pass ? " pr-strip--known" : "")}>
      {pass ? (
        <>
          <div className="pr-copy">
            <span className="pr-eyebrow">Your pass</span>
            <b>{pass.passCode}</b>
            <em>{pass.name}</em>
          </div>
          <a className="pr-link" href={passLookupHref(pass)}>
            Show my QR
          </a>
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
