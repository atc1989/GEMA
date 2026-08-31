"use client";

import { Fragment } from "react";

import { BookSheet } from "@/components/landing/book-sheet";
import { MediaCarousel } from "@/components/landing/media-carousel";
import type { Clinician, PublicLanding } from "@/lib/ginhawa/public-landing";
import { MarkdownBody } from "@/lib/ginhawa/markdown";
import { landingSlides } from "@/lib/ginhawa/media";
import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";

import "./session-landing.css";

function TitleLines({ title }: { title: string }) {
  const lines = title.split("\n");
  return (
    <h1 className="session-title">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </h1>
  );
}

function speakerLabel(p: Clinician) {
  return p.suffix ? `${p.name}, ${p.suffix}` : p.name;
}

/** Clean public landing for presentations, training, and business sessions. */
export function SessionLanding({
  landing,
  refCode,
}: {
  landing: PublicLanding;
  refCode?: string | null;
}) {
  const slides = landingSlides(landing);
  const shop = shopEntryUrl();
  const seats =
    landing.capacity != null ? Math.max(0, landing.capacity - landing.seatsTaken) : null;
  const showGift = landing.giftPoints > 0;

  return (
    <div className="session-root" id="top">
      <header className="session-top">
        <div className="session-shell session-top-inner">
          <a className="session-brand" href="#top">
            GutGuard
          </a>
          <div className="session-top-actions">
            <a className="session-nav-link" href="#event">
              Session
            </a>
            <a className="session-nav-link" href={shop}>
              Shop
            </a>
            {landing.bookUrl ? (
              <a className="session-btn session-btn-primary" href={landing.bookUrl}>
                Reserve seat
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section className="session-hero" id="event">
        <div className="session-shell session-hero-grid">
          <div>
            <div className="session-kicker">Live session</div>
            <TitleLines title={landing.title} />
            {landing.heroWhat ? <p className="session-lead">{landing.heroWhat}</p> : null}
            <div className="session-hero-actions">
              {landing.bookUrl ? (
                <a className="session-btn session-btn-primary" href={landing.bookUrl}>
                  Reserve your seat
                </a>
              ) : null}
              {(landing.venueName || landing.venueAddress) && (
                <a className="session-btn session-btn-ghost" href="#venue">
                  Venue details
                </a>
              )}
            </div>
          </div>

          <aside className="session-facts" aria-label="Session details">
            {landing.dateLabel ? (
              <div className="session-fact">
                <span className="session-fact-label">When</span>
                <span className="session-fact-value">{landing.dateLabel}</span>
              </div>
            ) : null}
            {landing.timeLabel ? (
              <div className="session-fact">
                <span className="session-fact-label">Time</span>
                <span className="session-fact-value">{landing.timeLabel}</span>
              </div>
            ) : null}
            {landing.venueName || landing.venueAddress ? (
              <div className="session-fact">
                <span className="session-fact-label">Where</span>
                <span className="session-fact-value">
                  {[landing.venueName, landing.venueAddress].filter(Boolean).join(" · ")}
                </span>
              </div>
            ) : null}
            {seats != null ? (
              <div className="session-fact">
                <span className="session-fact-label">Seats left</span>
                <span className="session-fact-value">{seats}</span>
              </div>
            ) : (
              <div className="session-fact">
                <span className="session-fact-label">Seating</span>
                <span className="session-fact-value">Open</span>
              </div>
            )}
          </aside>
        </div>
      </section>

      <main>
        {landing.clinicians.length ? (
          <section id="speakers" className="session-section">
            <div className="session-shell">
              <div className="session-section-head">
                <h2 className="session-section-title">Speakers</h2>
                <p className="session-section-sub">The people guiding this session.</p>
              </div>
              <div className="session-people">
                {landing.clinicians.map((p) => (
                  <article key={p.id} className="session-person">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="session-person-photo" src={p.photo} alt={p.name} />
                    ) : (
                      <div className="session-person-fallback" aria-hidden>
                        {p.initials}
                      </div>
                    )}
                    <div>
                      <h3 className="session-person-name">{speakerLabel(p)}</h3>
                      {p.role ? <p className="session-person-role">{p.role}</p> : null}
                      {p.credentialsMd ? (
                        <div className="session-person-bio">
                          <MarkdownBody md={p.credentialsMd} />
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {(landing.askTitle || landing.askBody) && (
          <section className="session-section session-section-alt">
            <div className="session-shell">
              <div className="session-section-head">
                {landing.askTitle ? (
                  <h2 className="session-section-title">{landing.askTitle}</h2>
                ) : (
                  <h2 className="session-section-title">Why attend</h2>
                )}
              </div>
              <div className="session-prose">
                {landing.askBody ? <p>{landing.askBody}</p> : null}
                {landing.askHit ? <p>{landing.askHit}</p> : null}
              </div>
            </div>
          </section>
        )}

        {slides.length ? (
          <section className="session-section">
            <div className="session-shell">
              <div className="session-section-head">
                <h2 className="session-section-title">Watch</h2>
              </div>
              <MediaCarousel items={slides} label="Event media" className="session-media" />
            </div>
          </section>
        ) : null}

        {showGift ? (
          <section className="session-section session-section-alt">
            <div className="session-shell">
              <div className="session-gift">
                <h3>{landing.giftPoints} E-Points gift</h3>
                <p>Worth ₱{landing.giftPeso} in product for guests who check in.</p>
                {landing.bookUrl ? (
                  <div>
                    <a className="session-btn session-btn-primary" href={landing.bookUrl}>
                      Claim seat & gift
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {(landing.gutTitle || landing.gutBody) && (
          <section className="session-section">
            <div className="session-shell">
              <div className="session-section-head">
                {landing.gutTitle ? (
                  <h2 className="session-section-title">{landing.gutTitle}</h2>
                ) : (
                  <h2 className="session-section-title">What you leave with</h2>
                )}
              </div>
              <div className="session-prose">
                {landing.gutBody ? <p>{landing.gutBody}</p> : null}
                {landing.gutClose ? <p>{landing.gutClose}</p> : null}
              </div>
            </div>
          </section>
        )}

        {(landing.venueName || landing.venueAddress) && (
          <section id="venue" className="session-section session-section-alt">
            <div className="session-shell">
              <div className="session-section-head">
                <h2 className="session-section-title">Venue</h2>
                <p className="session-section-sub">
                  {[landing.venueName, landing.venueAddress].filter(Boolean).join(" · ")}
                </p>
              </div>
              {landing.mapEmbedSrc ? (
                <div className="session-map-frame">
                  <iframe
                    title="Venue map"
                    src={landing.mapEmbedSrc}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              ) : null}
              {landing.mapUrl ? (
                <p style={{ marginTop: "0.85rem" }}>
                  <a href={landing.mapUrl} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                </p>
              ) : null}
            </div>
          </section>
        )}
      </main>

      <footer className="session-footer">
        <div className="session-shell">
          <p>GutGuard · focused sessions for members and guests.</p>
        </div>
      </footer>

      {landing.bookUrl ? (
        <div className="session-cta-bar">
          <a className="session-btn session-btn-primary" href={landing.bookUrl}>
            Reserve your seat
          </a>
        </div>
      ) : null}

      <BookSheet
        eventId={landing.sourceEventId}
        refCode={refCode}
        giftPoints={landing.giftPoints}
      />
    </div>
  );
}
