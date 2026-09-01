"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import {
  registerProspectForEvent,
  type FieldErrors,
  type RegistrationSuccess,
} from "@/lib/actions/registration";

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
export function BookSheet({ eventId, refCode, giftPoints = 0, passAnchor, onRegistered }: Props) {
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
  const [qr, setQr] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

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
    consent;

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
    });

    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      return;
    }
    setSuccess(result.data);
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
            <p className="bs-fine">
              {passAnchor ? "Download it there, or " : "Screenshot this, or "}
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
                Put your name on it
              </h3>
              <p className="bs-p">
                {giftPoints > 0
                  ? `We will hold ${giftPoints} E-Points on your card until the day. Yours the moment you check in.`
                  : "We will text you the details. Nobody will ring you to sell you anything."}
              </p>
            </div>

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

            {formError ? (
              <p className="bs-alert" role="alert">
                {formError}
              </p>
            ) : null}

            <button type="submit" className="bs-btn bs-btn--wide" disabled={!ready || pending}>
              {pending ? "Booking your seat…" : "Claim my card"}
            </button>
            <p className="bs-fine">Free. Nobody will ring you to sell you anything.</p>
            <p className="bs-fine">
              Already have a GEMA or One Grinders account?{" "}
              <a className="bs-link" href={`/login?redirectTo=${encodeURIComponent(registerPath)}`}>
                Log in instead
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
