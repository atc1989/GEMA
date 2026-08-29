"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { Confetti } from "@/components/landing/confetti";
import { MediaCarousel } from "@/components/landing/media-carousel";
import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";
import { MarkdownBody } from "@/lib/ginhawa/markdown";
import type { Clinician, PublicLanding } from "@/lib/ginhawa/public-landing";
import { landingSlides } from "@/lib/ginhawa/media";

import "./checkup-landing.css";

function TitleLines({ title }: { title: string }) {
  const lines = title.split("\n");
  return (
    <h1>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </h1>
  );
}

function clinicianLabel(p: Clinician) {
  return p.suffix ? `${p.name}, ${p.suffix}` : p.name;
}

type Holder = { name: string; mobile: string };

/**
 * Narrow, single-column check-up landing — the Ginhawa prototype layout.
 * Public landing only: the booked/pass state lives in registration, not here.
 */
export function CheckupLanding({ landing }: { landing: PublicLanding }) {
  const hero = useRef<HTMLElement>(null);
  const [showBar, setShowBar] = useState(false);
  const [claim, setClaim] = useState(false);
  const [holder, setHolder] = useState<Holder | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [fire, setFire] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);

  // The sticky bar appears once the hero is behind you.
  // ponytail: scroll listener, not IntersectionObserver — measured against the
  // hero's real height so there is no magic pixel threshold to re-tune.
  useEffect(() => {
    const onScroll = () => {
      const heroHeight = hero.current?.offsetHeight ?? 0;
      setShowBar(window.scrollY > heroHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page and trap Tab while the claim sheet is up.
  useEffect(() => {
    if (!claim) return;
    document.body.style.overflow = "hidden";
    const root = dialog.current;
    const focusables = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const items = focusables();
    (items.find((el) => el.tagName === "INPUT") ?? items[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setClaim(false);
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
    };
  }, [claim]);

  const claimValid = name.trim().length > 1 && mobile.replace(/\D/g, "").length >= 10;

  // ponytail: the card is claimed on-screen only — nothing is written yet.
  // Real registration needs an email and a privacy consent, so the seat is
  // still booked at /register; wire this to registerProspectForEvent once
  // those two fields exist here.
  const issueCard = () => {
    if (!claimValid) return;
    setHolder({ name: name.trim(), mobile: mobile.trim() });
    setClaim(false);
    setFire(Date.now());
  };

  const shop = shopEntryUrl();
  const slides = landingSlides(landing);
  const seats = landing.capacity;
  const left = seats == null ? null : Math.max(seats - landing.seatsTaken, 0);
  const takenPct = seats && seats > 0 ? Math.min(100, (landing.seatsTaken / seats) * 100) : 0;
  const showAsk = Boolean(landing.askTitle || landing.askBody || landing.askHit);
  const showGut = Boolean(landing.gutTitle || landing.gutBody || landing.gutClose);
  const showVenue = Boolean(landing.venueName || landing.venueAddress || landing.mapUrl);
  const showGift = landing.giftPoints > 0;

  const mapVisual = landing.mapEmbedSrc ? (
    <iframe
      src={landing.mapEmbedSrc}
      title={landing.venueName ? `Map of ${landing.venueName}` : "Map of the venue"}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  ) : (
    <img
      src="/venue-map.png"
      alt={landing.venueName ? `Map of ${landing.venueName}` : "Map of the venue"}
      width={640}
      height={420}
    />
  );

  return (
    <div className="ck-surface" id="top">
      <header className="ck-hero" id="event" ref={hero}>
        <img src="/watermark.png" alt="" aria-hidden="true" className="ck-hero-g" />
        <div className="ck-hero-in">
          <div className="ck-brandline">
            <img src="/wordmark.png" alt="Gutguard" width={110} height={19} />
            <em>Ginhawa</em>
          </div>

          <TitleLines title={landing.title} />

          {landing.dateLabel || landing.timeLabel ? (
            <div className="ck-when">
              {landing.dateLabel ? <b>{landing.dateLabel}</b> : null}
              {landing.timeLabel ? <span>{landing.timeLabel}</span> : null}
            </div>
          ) : null}

          {landing.clinicians.length ? (
            <div className="ck-docs">
              {landing.clinicians.map((p) => (
                <details className="ck-doc" key={p.id}>
                  <summary>
                    <span className="ck-ini">{p.initials}</span>
                    <span className="ck-doc-txt">
                      <b>{clinicianLabel(p)}</b>
                      {p.role ? <em>{p.role}</em> : null}
                    </span>
                    <span className="ck-doc-more">Credentials</span>
                  </summary>
                  <div className="ck-doc-body">
                    {p.credentialsMd ? <MarkdownBody md={p.credentialsMd} /> : null}
                    {p.licence ? (
                      <dl className="ck-licence">
                        <dt>Licence</dt>
                        <dd>{p.licence}</dd>
                      </dl>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          ) : null}

          {landing.heroWhat ? <p className="ck-hero-what">{landing.heroWhat}</p> : null}

          {landing.bookUrl ? (
            <a className="ck-cta ck-cta--big" href={landing.bookUrl}>
              Book my seat
            </a>
          ) : null}

          {showGift ? (
            <div className="ck-hero-gift">
              <b>{landing.giftPoints} E-Points, free</b>
              <em>worth ₱{landing.giftPeso} in product</em>
            </div>
          ) : null}

          <p className="ck-hero-note">
            {left == null || seats == null ? "Free" : `Free · ${left} of ${seats} seats left`}
          </p>
        </div>
      </header>

      <main className="ck-wrap">
        {slides.length ? (
          <section className="ck-meet">
            <MediaCarousel items={slides} label="Meet the clinicians" className="ck-media" />
          </section>
        ) : null}

        {showAsk ? (
          <section className="ck-ask">
            {landing.askTitle ? <h2>{landing.askTitle}</h2> : null}
            {landing.askBody ? <p>{landing.askBody}</p> : null}
            {landing.askHit ? <p className="ck-ask-hit">{landing.askHit}</p> : null}
          </section>
        ) : null}

        {showGut ? (
          <section className="ck-gut">
            <div className="ck-gut-mark" aria-hidden="true">
              <img src="/watermark.png" alt="" />
            </div>
            {landing.gutTitle ? <h3>{landing.gutTitle}</h3> : null}
            {landing.gutBody ? <p>{landing.gutBody}</p> : null}
            {landing.gutClose ? <p className="ck-gut-close">{landing.gutClose}</p> : null}
          </section>
        ) : null}

        <section className="ck-steps">
          <h3 className="ck-sec">What happens on the day</h3>
          {[
            ["You sit down", "The doctor and the nurse will listen. No queue behind you."],
            [
              "They tell you straight",
              "Whether it is nothing, or whether it should be checked properly now.",
            ],
            [
              "You go home",
              `With your Lifestyle Card and ${landing.giftPoints} points on it — worth ₱${landing.giftPeso} of Gutguard.`,
            ],
          ].map(([t, d], i, all) => (
            <div className={"ck-step" + (i === all.length - 1 ? " ck-step--last" : "")} key={t}>
              <span className="ck-num">{i + 1}</span>
              <div>
                <b>{t}</b>
                <em>{d}</em>
              </div>
            </div>
          ))}
          <div className="ck-promises">
            <span>Around 20 minutes</span>
            <span>No one will hurry you</span>
            <span>No one will sell you anything</span>
          </div>
        </section>

        {showGift ? (
          <section className="ck-gift">
            <div className="ck-gift-lead">
              <div className="ck-gift-eyebrow">A gift for our guests · limited</div>
              <h3>You go home with this.</h3>
            </div>

            {holder ? (
              <div className="ck-lc">
                <img src="/watermark.png" alt="" aria-hidden="true" className="ck-lc-mark" />
                <div className="ck-lc-body">
                  <div className="ck-lc-brand">
                    <img src="/wordmark.png" alt="Gutguard" width={110} height={19} />
                    <div className="ck-lc-lifestyle">Lifestyle</div>
                  </div>
                  <div className="ck-lc-name">{holder.name}</div>
                  <div className="ck-lc-state ck-lc-state--on">GUEST · PASS RESERVED</div>
                  <div className="ck-lc-since">Issued today · {holder.mobile}</div>
                  <div className="ck-lc-pts">
                    <div className="ck-lc-num">{landing.giftPoints}</div>
                    <div className="ck-lc-lbl">E-POINTS</div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ck-lc ck-lc--tap"
                onClick={() => setClaim(true)}
                aria-label="Claim your Ginhawa Pass"
              >
                <img src="/watermark.png" alt="" aria-hidden="true" className="ck-lc-mark" />
                <div className="ck-lc-body">
                  <div className="ck-lc-brand">
                    <img src="/wordmark.png" alt="Gutguard" width={110} height={19} />
                    <div className="ck-lc-lifestyle">Lifestyle</div>
                  </div>
                  <span className="ck-lc-name ck-lc-claim">
                    Your name
                    <span className="ck-lc-tapme">Tap to claim</span>
                  </span>
                  <div className="ck-lc-state">NOT YET ACTIVE</div>
                  <div className="ck-lc-since">Issued on the day</div>
                  <div className="ck-lc-pts">
                    <div className="ck-lc-num">{landing.giftPoints}</div>
                    <div className="ck-lc-lbl">E-POINTS</div>
                  </div>
                </div>
              </button>
            )}

            <div className="ck-gift-notes">
              <div className="ck-gn">
                <span className="ck-dot" />
                <div>
                  <b>
                    {landing.giftPoints} points, worth ₱{landing.giftPeso} in free product
                  </b>
                  <em>
                    Your Ginhawa Pass — reserved for guests of the {landing.dateLabel} check-up.
                  </em>
                </div>
              </div>
              <div className="ck-gn">
                <span className="ck-dot" />
                <div>
                  <b>Yours the moment you check in</b>
                  <em>
                    {holder
                      ? "Your card says PASS RESERVED until the scan at the door."
                      : "The card says NOT YET ACTIVE until you are in the room."}
                  </em>
                </div>
              </div>
            </div>

            {holder && landing.bookUrl ? (
              <a className="ck-cta ck-cta--wide" href={landing.bookUrl}>
                Finish booking my seat
              </a>
            ) : null}

            <p className="ck-gift-fine">
              Points are redeemed for product, not cash. For attending — not in exchange for the
              consultation.
            </p>
          </section>
        ) : null}

        <section className="ck-bring">
          <h3 className="ck-sec">Bring with you</h3>
          <ul>
            <li>Your medicines — including herbal ones</li>
            <li>Any recent lab results</li>
            <li>Someone with you, if you would rather not come alone</li>
          </ul>
        </section>

        {landing.bookUrl ? (
          <section className="ck-book" id="book">
            {seats != null && left != null ? (
              <div className="ck-seatline">
                <div
                  className="ck-seatbar"
                  role="progressbar"
                  aria-valuenow={landing.seatsTaken}
                  aria-valuemin={0}
                  aria-valuemax={seats}
                  aria-label={`${left} of ${seats} seats left`}
                >
                  <i style={{ width: `${takenPct}%` }} />
                </div>
                <b>{left} seats left</b>
              </div>
            ) : null}
            <h3>Book your seat</h3>
            <a className="ck-cta ck-cta--wide" href={landing.bookUrl}>
              Book my seat
            </a>
            <p className="ck-fine">Free. No payment at any point.</p>
            <p className="ck-fine">
              We will text you the details. Nobody will ring you to sell you anything.
            </p>
          </section>
        ) : null}

        {showVenue ? (
          <section className="ck-where">
            <h3 className="ck-sec">Where</h3>
            <div className="ck-venue">
              {landing.venueName ? <b>{landing.venueName}</b> : null}
              {landing.venueAddress ? <em>{landing.venueAddress}</em> : null}
              {landing.mapUrl ? (
                <a className="ck-maplink" href={landing.mapUrl} target="_blank" rel="noreferrer">
                  Open in Google Maps →
                </a>
              ) : null}
              <div className="ck-venue-map">{mapVisual}</div>
            </div>
          </section>
        ) : null}

        <section className="ck-why">
          <h3 className="ck-sec">Why we do this</h3>
          <p>
            We make a gut health product, and we would rather people saw a doctor first. Everyone
            who comes goes home with a Lifestyle Card. For attending, not in exchange for the
            consultation.
          </p>
          <p className="ck-why-hit">Nothing is sold here.</p>
        </section>

        <footer className="ck-foot">
          <img src="/wordmark.png" alt="Gutguard" className="ck-foot-mark" width={120} height={21} />
          <p>For emergencies, please go to the hospital.</p>
          <p className="ck-legal">
            {landing.clinicians
              .map((p) => `${clinicianLabel(p)}${p.licence ? ` · ${p.licence}` : ""}`)
              .join(" · ")}
            {landing.clinicians.length ? " · " : ""}
            Gutguard Philippines Inc. · <a href={shop}>Shop</a>
          </p>
        </footer>
      </main>

      {landing.bookUrl ? (
        <div className="ck-stick" data-on={showBar}>
          <div className="ck-stick-in">
            <div className="ck-stick-grow">
              <b>
                {landing.dateLabel}
                {landing.timeLabel ? ` · ${landing.timeLabel}` : ""}
              </b>
              {seats != null && left != null ? (
                <>
                  <div className="ck-stick-bar" aria-hidden="true">
                    <i style={{ width: `${takenPct}%` }} />
                  </div>
                  <em>
                    {left} of {seats} seats left
                  </em>
                </>
              ) : null}
            </div>
            <a className="ck-cta" href={landing.bookUrl}>
              Book my seat
            </a>
          </div>
        </div>
      ) : null}

      {claim ? (
        <div
          className="ck-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ck-claim-title"
          onClick={() => setClaim(false)}
        >
          <div className="ck-sheet" ref={dialog} onClick={(e) => e.stopPropagation()}>
            <div className="ck-grab" aria-hidden="true" />
            <div className="ck-claim-head">
              <div className="ck-gift-eyebrow">Your Ginhawa Pass</div>
              <h3 id="ck-claim-title">Put your name on it</h3>
              <p className="ck-fine ck-fine--left">
                We will hold {landing.giftPoints} E-Points on your card until the day. Yours the
                moment you check in.
              </p>
            </div>
            <label className="ck-label">
              <span>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
              />
            </label>
            <label className="ck-label">
              <span>Mobile number</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="09XX XXX XXXX"
                autoComplete="tel"
                inputMode="numeric"
                type="tel"
              />
            </label>
            <button
              type="button"
              className="ck-cta ck-cta--wide"
              disabled={!claimValid}
              onClick={issueCard}
            >
              Claim my card
            </button>
            <p className="ck-fine">Free. Nobody will ring you to sell you anything.</p>
          </div>
        </div>
      ) : null}

      <Confetti fire={fire} />
    </div>
  );
}
