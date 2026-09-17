/**
 * A breadcrumb back to a pass the guest already booked.
 *
 * Deliberately does NOT keep the QR token. That token is what gets them through
 * the door, and `/passes` will re-issue it server-side once they prove name plus
 * email or mobile — so what is kept here is only enough to fill that lookup in
 * for them. Per-device by nature: a guest who books on a phone and opens the
 * page on a laptop still has the manual lookup, which is why the landing shows
 * a "find my pass" link whether or not anything is stored.
 */

export type BookedPass = {
  passCode: string;
  name: string;
  /** Email or mobile — whichever they registered with. */
  contact: string;
  bookedAt: string;
};

const PREFIX = "gg-pass:";

function key(eventId: string): string {
  return `${PREFIX}${eventId}`;
}

export function rememberBookedPass(eventId: string, pass: BookedPass): void {
  try {
    window.localStorage.setItem(key(eventId), JSON.stringify(pass));
  } catch {
    // Private mode, blocked storage, quota. The lookup link still works.
  }
}

export function readBookedPass(eventId: string): BookedPass | null {
  try {
    const raw = window.localStorage.getItem(key(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookedPass>;
    if (!parsed?.passCode || !parsed?.name || !parsed?.contact) return null;
    return {
      passCode: parsed.passCode,
      name: parsed.name,
      contact: parsed.contact,
      bookedAt: parsed.bookedAt ?? "",
    };
  } catch {
    return null;
  }
}

export function forgetBookedPass(eventId: string): void {
  try {
    window.localStorage.removeItem(key(eventId));
  } catch {
    // Nothing to do — the strip just stays until storage works again.
  }
}

/** The lookup URL, pre-filled when we know who they are. */
export function passLookupHref(pass?: BookedPass | null): string {
  if (!pass) return "/passes";
  return `/passes?q=${encodeURIComponent(pass.contact)}&name=${encodeURIComponent(pass.name)}`;
}
