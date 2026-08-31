"use client";

import { Fragment } from "react";

import { BookSheet } from "@/components/landing/book-sheet";
import { MediaCarousel } from "@/components/landing/media-carousel";
import type { Clinician, PublicLanding } from "@/lib/ginhawa/public-landing";
import { MarkdownBody } from "@/lib/ginhawa/markdown";
import { landingSlides } from "@/lib/ginhawa/media";
import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";

import "./sizzle-landing.css";

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

function speakerLabel(p: Clinician) {
  return p.suffix ? `${p.name}, ${p.suffix}` : p.name;
}

/** High-energy public landing for Sizzle-style events. */
export function SizzleLanding({
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
    <div className="sz-surface" id="top">
      <header className="sz-top">
        <a className="sz-brand" href="#top">
          <img src="/wordmark.png" alt="Gutguard" width={110} height={19} />
          <em>Sizzle</em>
        </a>
        <nav className="sz-nav" aria-label="Primary">
          <a href="#event">Event</a>
          <a href={shop}>Shop</a>
        </nav>
        {landing.bookUrl ? (
          <a className="sz-btn sz-btn--solid" href={landing.bookUrl}>
            Reserve my seat
          </a>
        ) : null}
      </header>

      <section className="sz-hero" id="event">
        <div className="sz-hero-in">
          <p className="sz-kicker">Live room · open invite</p>
          <TitleLines title={landing.title} />
          <div className="sz-when">
            <b>{landing.dateLabel}</b>
            <span>{landing.timeLabel}</span>
          </div>
          {landing.heroWhat ? <p className="sz-lede">{landing.heroWhat}</p> : null}
          <div className="sz-cta-row">
            {landing.bookUrl ? (
              <a className="sz-btn sz-btn--gold" href={landing.bookUrl}>
                Reserve my seat
              </a>
            ) : null}
            {seats != null ? (
              <p className="sz-seats">{seats} seats left</p>
            ) : (
              <p className="sz-seats">Open seating</p>
            )}
          </div>
        </div>
      </section>

      <main className="sz-main">
        {landing.clinicians.length ? (
          <section className="sz-hosts">
            <h2>On the mic</h2>
            <ul>
              {landing.clinicians.map((p) => (
                <li key={p.id}>
                  <span className="sz-ini">{p.initials}</span>
                  <div>
                    <b>{speakerLabel(p)}</b>
                    {p.role ? <em>{p.role}</em> : null}
                    {p.credentialsMd ? <MarkdownBody md={p.credentialsMd} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(landing.askTitle || landing.askBody) && (
          <section className="sz-why">
            {landing.askTitle ? <h2>{landing.askTitle}</h2> : null}
            {landing.askBody ? <p>{landing.askBody}</p> : null}
            {landing.askHit ? <p className="sz-hit">{landing.askHit}</p> : null}
          </section>
        )}

        {slides.length ? (
          <section className="sz-video">
            <MediaCarousel items={slides} label="Event media" className="sz-media" />
          </section>
        ) : null}

        {showGift ? (
          <section className="sz-gift">
            <span className="sz-badge">{landing.giftPoints} E-Points</span>
            <p>Worth ₱{landing.giftPeso} in product for guests who check in.</p>
          </section>
        ) : null}

        {(landing.gutTitle || landing.gutBody) && (
          <section className="sz-leave">
            {landing.gutTitle ? <h2>{landing.gutTitle}</h2> : null}
            {landing.gutBody ? <p>{landing.gutBody}</p> : null}
            {landing.gutClose ? <p className="sz-hit">{landing.gutClose}</p> : null}
          </section>
        )}

        {(landing.venueName || landing.venueAddress) && (
          <section className="sz-venue">
            <h2>Where</h2>
            {landing.venueName ? <b>{landing.venueName}</b> : null}
            {landing.venueAddress ? <em>{landing.venueAddress}</em> : null}
            {landing.mapUrl ? (
              <a className="sz-btn sz-btn--ghost" href={landing.mapUrl} target="_blank" rel="noreferrer">
                Open map
              </a>
            ) : null}
            {landing.mapEmbedSrc ? (
              <iframe
                className="sz-map"
                src={landing.mapEmbedSrc}
                title="Venue map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : null}
          </section>
        )}
      </main>

      <footer className="sz-foot">
        <img src="/wordmark.png" alt="Gutguard" width={100} height={18} />
        {landing.bookUrl ? (
          <a className="sz-btn sz-btn--solid" href={landing.bookUrl}>
            Reserve my seat
          </a>
        ) : null}
      </footer>

      <BookSheet
        eventId={landing.sourceEventId}
        refCode={refCode}
        giftPoints={landing.giftPoints}
      />
    </div>
  );
}
