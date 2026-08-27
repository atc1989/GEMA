"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/landing/top-bar";
import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";
import type { Clinician, GinhawaLanding } from "@/lib/ginhawa/public-landing";
import { MarkdownBody } from "@/lib/ginhawa/markdown";
import { resolveVideo } from "@/lib/ginhawa/video";

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

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

export function GinhawaLanding({ landing }: { landing: GinhawaLanding }) {
  const [who, setWho] = useState<Clinician | null>(null);
  const [claim, setClaim] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [holder, setHolder] = useState<Holder | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const shop = shopEntryUrl();
  const seats = landing.capacity;
  const taken = landing.seatsTaken;
  const left = seats == null ? null : Math.max(seats - taken, 0);
  const video = resolveVideo(landing.videoUrl);
  const showVenue = Boolean(landing.venueName || landing.venueAddress || landing.mapUrl);
  const showWhen = Boolean(landing.dateLabel || landing.timeLabel);
  const showWhere = showVenue || showWhen;
  const mapImg = (
    <img
      src="/venue-map.png"
      alt={landing.venueName ? `Map of ${landing.venueName}` : "Map of the venue"}
      width={640}
      height={420}
    />
  );
  const mapVisual = landing.mapEmbedSrc ? (
    <iframe
      src={landing.mapEmbedSrc}
      title={landing.venueName ? `Map of ${landing.venueName}` : "Map of the venue"}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  ) : (
    mapImg
  );
  const showAsk = Boolean(landing.askTitle || landing.askBody || landing.askHit);
  const showGut = Boolean(landing.gutTitle || landing.gutBody || landing.gutClose);
  const sent = Boolean(holder);
  const valid = name.trim().length > 1 && mobile.replace(/\D/g, "").length >= 10;
  const overlayOpen = claim || Boolean(who);

  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    if (!overlayOpen) return;

    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = dialogRef.current;
    const focusables = () => {
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    };
    const items = focusables();
    const input = items.find((el) => el.tagName === "INPUT");
    (input ?? items[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setClaim(false);
        setWho(null);
        return;
      }
      if (e.key !== "Tab") return;
      const trap = focusables();
      if (!trap.length) return;
      const start = trap[0];
      const end = trap[trap.length - 1];
      if (e.shiftKey && document.activeElement === start) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        start.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus();
    };
  }, [overlayOpen]);

  const openClaim = () => {
    if (sent) return;
    setClaim(true);
  };

  const issue = (n: string, m: string) => {
    setHolder({ name: n.trim(), mobile: m.trim() });
    setName(n.trim());
    setMobile(m.trim());
    setClaim(false);
  };

  return (
    <div id="top">
      <TopBar bookUrl={landing.bookUrl} />

      <header className="hero" id="event">
        <img src="/watermark.png" alt="" aria-hidden="true" className="hero-g" />
        <div className="hero-in hero-grid">
          <div>
            <TitleLines title={landing.title} />
            <div className="when">
              <b>{landing.dateLabel}</b>
              <span>{landing.timeLabel}</span>
            </div>
            {landing.heroWhat ? <p className="hero-what">{landing.heroWhat}</p> : null}
            {landing.bookUrl ? (
              <a className="gg-button gg-button--bone" href={landing.bookUrl} rel="noopener noreferrer">
                Book my seat
              </a>
            ) : null}
            <div className="hero-gift">
              <span className="gg-badge gg-badge--gold">{landing.giftPoints} E-Points, free</span>
              <em>worth ₱{landing.giftPeso} in product</em>
            </div>
            <p className="hero-note">
              {left == null || seats == null ? "Free" : `Free · ${left} of ${seats} seats left`}
            </p>
          </div>
          {landing.clinicians.length ? (
            <div className="docs">
              {landing.clinicians.map((p) => (
                <button key={p.id} className="doc" type="button" onClick={() => setWho(p)} aria-label={`See credentials for ${p.name}`}>
                  <span className="ini">{p.initials}</span>
                  <span className="doc-txt">
                    <b>{clinicianLabel(p)}</b>
                    <em>{p.role}</em>
                  </span>
                  <span className="doc-more" aria-hidden="true"><IconChevron /></span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <main className="wrap">
        <div className="meet-band">
          <section className="meet">
            <div
              className={"video" + (video?.kind === "drive" ? " video--drive" : "")}
              role="group"
              aria-label="Video: meet the doctor and nurse"
            >
              {video?.kind === "drive" ? (
                <iframe
                  src={video.src}
                  title={landing.videoCaption || "Event video"}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : video?.kind === "file" ? (
                <video controls playsInline preload="metadata" src={video.src} />
              ) : (
                <div className="video-ph">
                  <span className="play">▶</span>
                  {landing.videoLength ? <span className="vlen">{landing.videoLength}</span> : null}
                </div>
              )}
            </div>
            {landing.videoCaption ? <p className="vcap">{landing.videoCaption}</p> : null}
          </section>
          <div className="ask-gut">
            {showAsk ? (
              <section className="ask">
                {landing.askTitle ? <h2>{landing.askTitle}</h2> : null}
                {landing.askBody ? <p>{landing.askBody}</p> : null}
                {landing.askHit ? <p className="ask-hit">{landing.askHit}</p> : null}
              </section>
            ) : null}
            {showGut ? (
              <section className="gut">
                <div className="gut-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                {landing.gutTitle ? <h3>{landing.gutTitle}</h3> : null}
                {landing.gutBody ? <p>{landing.gutBody}</p> : null}
                {landing.gutClose ? <p className="gut-close">{landing.gutClose}</p> : null}
              </section>
            ) : null}
          </div>
        </div>

        <section className="steps">
          <h3 className="sec"><span className="sec-num">01</span> What happens on the day</h3>
          <div className="steps-grid">
            {[
              ["You sit down", "The doctor and the nurse will listen. No queue behind you."],
              ["They tell you straight", "Whether it is nothing, or whether it should be checked properly now."],
              ["You go home", `With your Lifestyle Card and ${landing.giftPoints} points on it — worth ₱${landing.giftPeso} of Gutguard.`],
            ].map(([t, d], i) => (
              <div className={"step" + (i === 2 ? " last" : "")} key={t}>
                <span className="num">{i + 1}</span>
                <div><b>{t}</b><em>{d}</em></div>
              </div>
            ))}
          </div>
          <div className="promises">
            <span className="gg-badge gg-badge--paid">Around 20 minutes</span>
            <span className="gg-badge gg-badge--paid">No one will hurry you</span>
            <span className="gg-badge gg-badge--paid">No one will sell you anything</span>
          </div>
        </section>

        <section className="gift">
          <div className="gift-layout">
            <div className="gift-lead">
              <div className="sec"><span className="sec-num">02</span> A gift for our guests · limited</div>
              <h3>You go home with this.</h3>
            </div>
            <div className="lc-stage">
              {holder ? (
                <div className="lc">
                  <img src="/watermark.png" alt="" aria-hidden="true" className="lc-mark" />
                  <div className="lc-body">
                    <span className="lc-chev" aria-hidden="true">▲</span>
                    <div className="lc-brand">
                      <img src="/wordmark.png" alt="Gutguard" />
                      <div className="lc-lifestyle">Lifestyle</div>
                    </div>
                    <div className="lc-name">{holder.name}</div>
                    <div className="lc-state on">GUEST · PASS RESERVED</div>
                    <div className="lc-no">{holder.mobile}</div>
                    <div className="lc-since">Issued today</div>
                    <div className="lc-row">
                      <span className="lc-pad" aria-hidden="true" />
                      <div className="lc-pts">
                        <div className="lc-num">{landing.giftPoints}</div>
                        <div className="lc-lbl">E-POINTS</div>
                      </div>
                      <span className="lc-pad" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              ) : (
                <button className="lc" type="button" onClick={openClaim} aria-label="Claim your Ginhawa Pass">
                  <img src="/watermark.png" alt="" aria-hidden="true" className="lc-mark" />
                  <div className="lc-body">
                    <span className="lc-chev" aria-hidden="true">▲</span>
                    <div className="lc-brand">
                      <img src="/wordmark.png" alt="Gutguard" />
                      <div className="lc-lifestyle">Lifestyle</div>
                    </div>
                    <span className="lc-claim">
                      Your name
                      <span className="lc-tapme">Tap to claim</span>
                    </span>
                    <div className="lc-state">NOT YET ACTIVE</div>
                    <div className="lc-since">Issued on the day</div>
                    <div className="lc-row">
                      <span className="lc-pad" aria-hidden="true" />
                      <div className="lc-pts">
                        <div className="lc-num">—</div>
                        <div className="lc-lbl">E-POINTS</div>
                      </div>
                      <span className="lc-pad" aria-hidden="true" />
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div>
              <div className="gift-notes">
                <div className="gn">
                  <span className="dot" />
                  <div>
                    <b>Worth ₱{landing.giftPeso} in free product.</b>
                    <em>Your Ginhawa Pass — reserved for guests of the {landing.dateLabel} talk.</em>
                  </div>
                </div>
                <div className="gn">
                  <span className="dot" />
                  <div>
                    <b>Yours the moment you check in</b>
                    <em>{holder ? "Your card says PASS RESERVED until the scan at the door." : "The card says NOT YET ACTIVE until you are in the room."}</em>
                  </div>
                </div>
              </div>
              <p className="gift-fine">
                Points are redeemed for product, not cash. For attending — not in exchange for the consultation.
              </p>
              {holder ? (
                <p className="shop-note">
                  After check-in, redeem at the{" "}
                  <a href={shop}>GutGuard shop</a>.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="logistics">
          <h3 className="sec"><span className="sec-num">03</span> Before you come</h3>
          <div className="close-pair">
            {showWhere ? (
              <article className="where">
                <h4 className="sec">Where and when</h4>
                <div className="where-split">
                  <div className="where-copy">
                    {showWhen ? (
                      <div className="when">
                        {landing.dateLabel ? <b>{landing.dateLabel}</b> : null}
                        {landing.timeLabel ? <span>{landing.timeLabel}</span> : null}
                      </div>
                    ) : null}
                    <div className="venue">
                      {landing.venueName ? <b>{landing.venueName}</b> : null}
                      {landing.venueAddress ? <em>{landing.venueAddress}</em> : null}
                      {landing.mapUrl ? (
                        <a className="gg-button gg-button--ghost" href={landing.mapUrl} target="_blank" rel="noreferrer">
                          <IconPin />
                          Open in Google Maps
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {landing.mapUrl && !landing.mapEmbedSrc ? (
                    <a className="venue-map" href={landing.mapUrl} target="_blank" rel="noreferrer">
                      {mapVisual}
                    </a>
                  ) : (
                    <div className="venue-map">{mapVisual}</div>
                  )}
                </div>
              </article>
            ) : null}
            <aside className="bring">
              <h4 className="sec">Bring with you</h4>
              <ul>
                <li>Your medicines — including herbal ones</li>
                <li>Any recent lab results</li>
                <li>Someone with you, if you would rather not come alone</li>
              </ul>
            </aside>
          </div>
        </section>

      </main>

      <div className="close-band">
        <div className="close-band-in">
          <section className="why">
            <h3 className="sec"><span className="sec-num">04</span> Why we do this</h3>
            <p>We make a gut health product, and we would rather people saw a doctor first.</p>
            <p className="why-hit">Nothing is sold here.</p>
          </section>
          <footer className="foot">
            <img src="/wordmark.png" alt="Gutguard" className="foot-mark" width={120} height={21} />
            <p className="foot-emerg">For emergencies, please go to the hospital.</p>
            <nav className="foot-nav" aria-label="GutGuard">
              <a href="#event">Event</a>
              <a href={shop}>Shop</a>
              <span className="soon">Lifestyle <span className="soon-tag">soon</span></span>
              <span className="soon">Gentrep <span className="soon-tag">soon</span></span>
            </nav>
          </footer>
          <p className="legal">
            {landing.clinicians
              .map((p) => `${clinicianLabel(p)}${p.licence ? ` · ${p.licence}` : ""}`)
              .join(" · ")}
            {landing.clinicians.length ? " · " : ""}
            Gutguard Philippines Inc.
          </p>
        </div>
      </div>

      {claim && !sent ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="claim-title" onClick={() => setClaim(false)}>
          <div className="gg-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
            <div className="gg-dialog-header">
              <div>
                <div className="gg-dialog-kicker">Your Ginhawa Pass</div>
                <h3 id="claim-title">Put your name on it</h3>
              </div>
              <button type="button" className="gg-icon-btn gg-icon-btn--ghost" aria-label="Close" onClick={() => setClaim(false)}>
                <IconX />
              </button>
            </div>
            <div className="gg-dialog-body">
              <p className="fine" style={{ textAlign: "left", marginTop: 0 }}>
                We will hold {landing.giftPoints} E-Points on your card until the event. Yours the moment you check in.
              </p>
              <label className="gg-field">
                <span className="gg-field__label">Your name</span>
                <input className="gg-field__control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan dela Cruz" autoComplete="name" />
              </label>
              <label className="gg-field">
                <span className="gg-field__label">Mobile number</span>
                <input className="gg-field__control" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09XX XXX XXXX" autoComplete="tel" inputMode="numeric" type="tel" />
              </label>
            </div>
            <div className="gg-dialog-footer">
              <button className="gg-button gg-button--ghost" type="button" onClick={() => setClaim(false)}>Cancel</button>
              <button
                className={"gg-button " + (valid ? "gg-button--primary" : "gg-button--secondary")}
                type="button"
                onClick={() => { if (valid) issue(name, mobile); }}
              >
                Claim my card
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {who ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cred-title" onClick={() => setWho(null)}>
          <div className="gg-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
            <div className="gg-dialog-header">
              <div className="cred-head">
                <span className="cred-photo">{who.initials}</span>
                <div className="cred-id">
                  <h3 id="cred-title">{clinicianLabel(who)}</h3>
                  <em>{who.role}</em>
                </div>
              </div>
              <button type="button" className="gg-icon-btn gg-icon-btn--ghost" aria-label="Close" onClick={() => setWho(null)}>
                <IconX />
              </button>
            </div>
            <div className="gg-dialog-body">
              <MarkdownBody md={who.credentialsMd} />
              {who.licence ? (
                <dl className="licence">
                  <dt>Licence</dt>
                  <dd>{who.licence}</dd>
                </dl>
              ) : null}
            </div>
            <div className="gg-dialog-footer">
              <button className="gg-button gg-button--ghost" type="button" onClick={() => setWho(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GinhawaEmpty() {
  const shop = shopEntryUrl();
  return (
    <div id="top">
      <TopBar />
      <header className="hero" id="event">
        <img src="/watermark.png" alt="" aria-hidden="true" className="hero-g" />
        <div className="hero-in">
          <h1>Ginhawa</h1>
          <p className="hero-what">No event is scheduled right now.</p>
          <p className="hero-note">Check back soon, or visit the shop in the meantime.</p>
          <a className="gg-button gg-button--bone" href={shop} style={{ marginTop: 22, display: "inline-flex" }}>
            GutGuard shop
          </a>
        </div>
      </header>
    </div>
  );
}
