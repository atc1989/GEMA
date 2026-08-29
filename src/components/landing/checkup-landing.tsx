"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";
import { MarkdownBody } from "@/lib/ginhawa/markdown";
import type { Clinician, PublicLanding } from "@/lib/ginhawa/public-landing";
import { resolveVideo } from "@/lib/ginhawa/video";

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

/**
 * Narrow, single-column check-up landing — the Ginhawa prototype layout.
 * Public landing only: the booked/pass state lives in registration, not here.
 */
export function CheckupLanding({ landing }: { landing: PublicLanding }) {
  const hero = useRef<HTMLElement>(null);
  const [showBar, setShowBar] = useState(false);

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

  const shop = shopEntryUrl();
  const video = resolveVideo(landing.videoUrl);
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
        <section className="ck-meet">
          <div className="ck-video" role="group" aria-label="Video: meet the clinicians">
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
              <div className="ck-video-ph">
                <span className="ck-play" aria-hidden="true">
                  ▶
                </span>
                {landing.videoLength ? <span className="ck-vlen">{landing.videoLength}</span> : null}
              </div>
            )}
          </div>
          {landing.videoCaption ? <p className="ck-vcap">{landing.videoCaption}</p> : null}
        </section>

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
              <svg viewBox="0 0 24 24">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
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

            <div className="ck-lc">
              <img src="/watermark.png" alt="" aria-hidden="true" className="ck-lc-mark" />
              <div className="ck-lc-body">
                <div className="ck-lc-brand">
                  <img src="/wordmark.png" alt="Gutguard" width={110} height={19} />
                  <div className="ck-lc-lifestyle">Lifestyle</div>
                </div>
                <div className="ck-lc-name">Your name</div>
                <div className="ck-lc-state">NOT YET ACTIVE</div>
                <div className="ck-lc-since">Issued on the day</div>
                <div className="ck-lc-pts">
                  <div className="ck-lc-num">{landing.giftPoints}</div>
                  <div className="ck-lc-lbl">E-POINTS</div>
                </div>
              </div>
            </div>

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
                  <em>The card says NOT YET ACTIVE until you are in the room.</em>
                </div>
              </div>
            </div>

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
    </div>
  );
}
