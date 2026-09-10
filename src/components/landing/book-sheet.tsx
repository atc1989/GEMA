"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import { loadEventScheduling } from "@/lib/actions/event-slots";
import { rememberBookedPass } from "@/lib/events/booked-pass";
import {
  registerProspectForEvent,
  type FieldErrors,
  type RegistrationSuccess,
} from "@/lib/actions/registration";
import {
  formatDayLabel,
  formatSlotChip,
  formatWindowRange,
  groupSlotsByDay,
  groupSlotsByHour,
  openSlots,
  slotDayKey,
  slotIsOpen,
  type EventScheduling,
} from "@/lib/events/slots";

import "./book-sheet.css";

type Props = {
  /** events.id — the landing's sourceEventId. */
  eventId: string;
  /** Raw ?ref= from the landing URL, so referral attribution survives. */
  refCode?: string | null;
  giftPoints?: number;
  /**
   * Element id of the template's own pass panel. Given one, the sheet hands the
   * QR over to the page instead of showing its own — a QR inside a dismissable
   * sheet is gone the moment the guest closes it.
   */
  passAnchor?: string;
  /** Fired once the seat is really booked, so a template can flip its own card. */
  onRegistered?: (booked: RegistrationSuccess) => void;
  /**
   * Arrival slots, on scheduled events. Given one, the sheet asks for a window
   * before it asks for a name. Omitted on Sizzle and Session, which book the
   * way they always have.
   */
  scheduling?: EventScheduling | null;
};

/**
 * Anything that used to send a guest to /register, plus any explicit
 * [data-book-cta] trigger (the Lifestyle Card).
 */
const OPEN_SELECTOR = 'a[href^="/register/"], [data-book-cta]';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Registration, in a bottom sheet, on the landing page itself.
 *
 * Mounted once per template. Guests never leave the landing: this posts to the
 * same registerProspectForEvent server action /register uses, so referral ->
 * sponsor resolution, the capacity check, the consent gate and the duplicate
 * index all behave identically. /register stays live as the no-JS fallback.
 */
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
    // Swallowed by in-app browsers. The Download button and the recall strip
    // on the landing are the ways through.
  }
}

export function BookSheet({
  eventId,
  refCode,
  giftPoints = 0,
  passAnchor,
  onRegistered,
  scheduling: initialScheduling = null,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);
  const [scheduling, setScheduling] = useState<EventScheduling | null>(initialScheduling);
  const [slotId, setSlotId] = useState<string | null>(null);
  // Time first, then details: availability is the scarce thing, and a guest who
  // has already picked 9:20 is far likelier to finish the form.
  const [step, setStep] = useState<"time" | "details">(
    initialScheduling ? "time" : "details",
  );
  const [refreshing, setRefreshing] = useState(false);
  // Which day of the run they are looking at. A Friday-Saturday clinic booked
  // as one event can carry weeks of windows, and one flat list of those is
  // unusable.
  const [day, setDay] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const autoSaved = useRef(false);

  // ponytail: one delegated listener instead of rewiring twelve anchors across
  // four templates — and it keeps Sizzle/Session as server components. Plain
  // left-click only, so cmd/middle-click and JS-off still reach /register.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target.closest(OPEN_SELECTOR) : null;
      if (!el) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The grid was rendered on the server and is already stale by the time the
  // sheet opens. Re-read it, and drop a picked window that has since gone.
  useEffect(() => {
    if (!open || !scheduling || success) return;
    let alive = true;
    setRefreshing(true);
    loadEventScheduling(eventId)
      .then((fresh) => {
        if (!alive || !fresh) return;
        setScheduling(fresh);
        setSlotId((current) => {
          if (!current) return current;
          const still = fresh.slots.find((slot) => slot.id === current);
          return still && slotIsOpen(still) ? current : null;
        });
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });
    return () => {
      alive = false;
    };
    // Only on open: re-running on every scheduling change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId, success]);

  // Lock the page and trap Tab while the sheet is up.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    restoreFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(sheet.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const items = focusables();
    (items.find((el) => el.tagName === "INPUT") ?? items[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const trap = focusables();
      if (!trap.length) return;
      const first = trap[0];
      const last = trap[trap.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus();
    };
  }, [open]);

  // The pass QR is drawn from the signed token the action returns. Skipped when
  // the page shows its own panel, which draws the same token itself.
  useEffect(() => {
    if (!success || passAnchor) return;
    let alive = true;
    QRCode.toDataURL(success.qrToken, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [success, passAnchor]);

  // Save the pass to their photos the moment it exists, wherever the QR ends up
  // — this sheet or the card below it. Best-effort by nature: in-app browsers
  // (Messenger, which is where most of this traffic comes from) swallow a
  // download silently, which is why the button and the recall strip both stay.
  // Ref-guarded, not state: Strict Mode re-runs effects and would save twice.
  useEffect(() => {
    if (!success || autoSaved.current) return;
    autoSaved.current = true;
    void savePassPng(success.qrToken, success.passCode);
  }, [success]);

  const registerPath = refCode
    ? `/register/${eventId}?ref=${encodeURIComponent(refCode)}`
    : `/register/${eventId}`;

  const finish = () => {
    setOpen(false);
    if (!passAnchor) return;
    // Next frame: the sheet's cleanup releases the body scroll lock first.
    requestAnimationFrame(() => {
      document
        .getElementById(passAnchor)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const ready =
    name.trim().length > 1 &&
    phone.replace(/\D/g, "").length >= 10 &&
    email.includes("@") &&
    consent &&
    // No walk-ins: a scheduled event is booked by window or not at all.
    (!scheduling || slotId !== null);

  const available = scheduling ? openSlots(scheduling) : [];
  const days = groupSlotsByDay(available, scheduling?.timezone);
  // Default to the first day that still has room, not to today: on a Saturday
  // that is already full the useful answer is next Friday.
  const activeDay = days.find((d) => d.key === day) ?? days[0] ?? null;
  const chosen = scheduling?.slots.find((slot) => slot.id === slotId) ?? null;
  const picking = Boolean(scheduling) && step === "time";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !ready) return;
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const result = await registerProspectForEvent({
      eventId,
      refCode: refCode ?? undefined,
      fullName: name,
      phone,
      email,
      consentPrivacy: consent,
      consentMarketing: marketing,
      slotId,
    });

    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      // Their window went while they were typing. Refresh the grid and send
      // them back to the picker — every field they filled stays filled.
      if (result.code === "slot_taken") {
        setSlotId(null);
        setStep("time");
        const fresh = await loadEventScheduling(eventId);
        if (fresh) setScheduling(fresh);
      }
      return;
    }
    setSuccess(result.data);
    // So the landing can point them back at their QR tomorrow. The token is
    // deliberately not stored — /passes re-issues it after checking name plus
    // contact.
    rememberBookedPass(eventId, {
      passCode: result.data.passCode,
      name: result.data.attendeeName,
      contact: email,
      bookedAt: new Date().toISOString(),
    });
    onRegistered?.(result.data);
    // Seats-left counters are server-rendered; pull the new count.
    router.refresh();
  };

  if (!open) return null;

  return (
    <div
      className="bs-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bs-title"
      onClick={() => setOpen(false)}
    >
      <div className="bs-sheet" ref={sheet} onClick={(e) => e.stopPropagation()}>
        <div className="bs-grab" aria-hidden="true" />

        {success ? (
          <div className="bs-done">
            <div className="bs-eyebrow">Your Ginhawa Pass</div>
            <h3 className="bs-h" id="bs-title">
              You&apos;re booked
            </h3>
            {success.slotStartsAt && success.slotEndsAt ? (
              <p className="bs-window">
                <span className="bs-window-label">Arrive</span>
                <b>{formatDayLabel(success.slotStartsAt, scheduling?.timezone)}</b>
                <b>
                  {formatWindowRange(
                    success.slotStartsAt,
                    success.slotEndsAt,
                    scheduling?.timezone,
                  )}
                </b>
              </p>
            ) : null}
            <p className="bs-p">
              {success.attendeeName}, your seat for {success.eventTitle} is confirmed.{" "}
              {passAnchor
                ? "Your pass and its QR are on your Lifestyle Card, below."
                : "Show this at the door."}
            </p>
            {passAnchor ? null : qr ? (
              <img
                className="bs-qr"
                src={qr}
                alt={`Pass QR for ${success.passCode}`}
                width={220}
                height={220}
              />
            ) : (
              <div className="bs-qr bs-qr--wait" aria-hidden="true" />
            )}
            <div className="bs-code">{success.passCode}</div>
            <button
              type="button"
              className="bs-btn bs-btn--wide bs-btn--ghost"
              onClick={() => void savePassPng(success.qrToken, success.passCode)}
            >
              Download my QR
            </button>
            <p className="bs-fine">
              {passAnchor
                ? "Saved to your downloads, and it is on your Lifestyle Card below. "
                : "Saved to your downloads. "}
              If it did not save,{" "}
              <a
                className="bs-link"
                href={`/passes?q=${encodeURIComponent(email)}&name=${encodeURIComponent(success.attendeeName)}`}
              >
                look it up again
              </a>{" "}
              with your name and email.
            </p>
            <button type="button" className="bs-btn bs-btn--wide" onClick={finish}>
              {passAnchor ? "See my card" : "Done"}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="bs-head">
              <div className="bs-eyebrow">Your Ginhawa Pass</div>
              <h3 className="bs-h" id="bs-title">
                {picking ? "Pick your arrival time" : "Put your name on it"}
              </h3>
              <p className="bs-p">
                {picking
                  ? "Come any time inside your window. You are seen in the order people arrive."
                  : giftPoints > 0
                    ? `We will hold ${giftPoints} E-Points on your card until the day. Yours the moment you check in.`
                    : "We will text you the details. Nobody will ring you to sell you anything."}
              </p>
              {chosen ? (
                <button
                  type="button"
                  className="bs-chosen"
                  onClick={() => setStep("time")}
                >
                  <span className="bs-chosen-label">Arrive</span>
                  <b>
                    {days.length > 1
                      ? `${formatDayLabel(chosen.startsAt, scheduling?.timezone)}, `
                      : ""}
                    {formatWindowRange(chosen.startsAt, chosen.endsAt, scheduling?.timezone)}
                  </b>
                  <span className="bs-chosen-change">Change</span>
                </button>
              ) : null}
            </div>

            {picking ? (
              <div className="bs-slots">
                {available.length === 0 ? (
                  <p className="bs-alert" role="status">
                    {refreshing
                      ? "Checking what is left…"
                      : "Every arrival time has gone. Watch for the next check-up date."}
                  </p>
                ) : (
                  <>
                    {days.length > 1 ? (
                      <div className="bs-days" role="group" aria-label="Days">
                        {days.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            className="bs-day"
                            aria-pressed={d.key === activeDay?.key}
                            onClick={() => setDay(d.key)}
                          >
                            {d.label}
                            <em>{d.slots.length} left</em>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {groupSlotsByHour(activeDay?.slots ?? [], scheduling?.timezone).map((group) => (
                    <div className="bs-slot-group" key={group.key}>
                      <div className="bs-slot-hour">{group.label}</div>
                      <div className="bs-slot-row" role="group" aria-label={`${group.label} arrival times`}>
                        {group.slots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className="bs-slot"
                            aria-pressed={slot.id === slotId}
                            onClick={() => {
                              setSlotId(slot.id);
                              setDay(slotDayKey(slot, scheduling?.timezone));
                              setFormError(null);
                              setStep("details");
                            }}
                          >
                            {formatSlotChip(slot, scheduling?.timezone)}
                            {slot.seatsTotal > 1 ? (
                              <em className="bs-slot-left">
                                {slot.seatsTotal - slot.seatsTaken} left
                              </em>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            ) : (
              <>
            <label className="bs-label">
              <span>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
              />
              {fieldErrors.fullName?.[0] ? (
                <em className="bs-err">{fieldErrors.fullName[0]}</em>
              ) : null}
            </label>

            <label className="bs-label">
              <span>Mobile number</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XX XXX XXXX"
                autoComplete="tel"
                inputMode="tel"
                type="tel"
              />
              {fieldErrors.phone?.[0] ? <em className="bs-err">{fieldErrors.phone[0]}</em> : null}
            </label>

            <label className="bs-label">
              <span>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@email.com"
                autoComplete="email"
                inputMode="email"
                type="email"
              />
              {fieldErrors.email?.[0] ? <em className="bs-err">{fieldErrors.email[0]}</em> : null}
            </label>

            <label className="bs-check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree to the privacy terms and consent to GEMA storing my details for this event.
              </span>
            </label>
            <label className="bs-check">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              <span className="bs-check-soft">
                Send me updates and invitations to future events.
              </span>
            </label>
              </>
            )}

            {formError ? (
              <p className="bs-alert" role="alert">
                {formError}
              </p>
            ) : null}

            {picking ? (
              <p className="bs-fine">Free. Nobody will ring you to sell you anything.</p>
            ) : (
              <>
                <button type="submit" className="bs-btn bs-btn--wide" disabled={!ready || pending}>
                  {pending ? "Booking your seat…" : "Claim my card"}
                </button>
                <p className="bs-fine">Free. Nobody will ring you to sell you anything.</p>
                <p className="bs-fine">
                  Already have a GEMA or One Grinders account?{" "}
                  <a
                    className="bs-link"
                    href={`/login?redirectTo=${encodeURIComponent(registerPath)}`}
                  >
                    Log in instead
                  </a>
                </p>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
