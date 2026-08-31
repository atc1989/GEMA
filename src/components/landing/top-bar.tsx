"use client";

import { useEffect, useRef, useState } from "react";
import { shopEntryUrl } from "@/lib/ginhawa/ecosystem";

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function TopBar({ bookUrl }: { bookUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const shop = shopEntryUrl();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const root = document.getElementById("top");
    const panel = panelRef.current;
    const locked: HTMLElement[] = [];
    if (root && panel) {
      for (const el of Array.from(root.children)) {
        if (el instanceof HTMLElement && el !== panel && !el.contains(panel)) {
          el.setAttribute("inert", "");
          el.setAttribute("aria-hidden", "true");
          locked.push(el);
        }
      }
    }

    const focusables = () => {
      if (!panel) return [] as HTMLElement[];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    };
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
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
      locked.forEach((el) => {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      });
      window.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="topbar-brand" href="#top">
            <img src="/wordmark.png" alt="Gutguard" width={120} height={21} />
            <em>Ginhawa</em>
          </a>
          <nav className="topbar-links" aria-label="Primary">
            <a href="#event" aria-current="page">Event</a>
            <a href={shop}>Shop</a>
            <span className="soon">Lifestyle <span className="soon-tag">soon</span></span>
            <span className="soon">Gentrep <span className="soon-tag">soon</span></span>
          </nav>
          <div className="topbar-actions">
            {bookUrl ? (
              <a className="gg-button gg-button--primary topbar-book" href={bookUrl} rel="noopener noreferrer">
                Book my seat
              </a>
            ) : null}
            <button
              className="topbar-menu"
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen(true)}
            >
              <span className="topbar-burger" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="sheet-nav" onClick={close}>
          <div
            className="sheet-nav-panel"
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-nav-title"
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-nav-head">
              <a className="topbar-brand" href="#top" onClick={close}>
                <img src="/wordmark.png" alt="Gutguard" width={120} height={21} />
                <em id="sheet-nav-title">Ginhawa</em>
              </a>
              <button type="button" className="gg-icon-btn gg-icon-btn--ghost" aria-label="Close" onClick={close}>
                <IconX />
              </button>
            </div>
            <nav className="sheet-nav-body" aria-label="Primary">
              <a href="#event" aria-current="page" onClick={close}>Event</a>
              <a href={shop} onClick={close}>Shop</a>
              <span className="soon">Lifestyle <span className="soon-tag">soon</span></span>
              <span className="soon">Gentrep <span className="soon-tag">soon</span></span>
            </nav>
            {bookUrl ? (
              <div className="sheet-nav-foot">
                {/* Close the nav first: this CTA opens the BookSheet in place,
                    and leaving the nav up stacks two focus traps and two
                    scroll locks on the same page. */}
                <a
                  className="gg-button gg-button--primary gg-button--wide"
                  href={bookUrl}
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  Book my seat
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
