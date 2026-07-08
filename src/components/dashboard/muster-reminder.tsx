"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { EpointParamStatus, MemberState, MusterToday } from "@/lib/muster";
import { cn } from "@/lib/utils";

/**
 * Muster Reminder — read-only overlay shown once per day on dashboard open.
 * Shows where the member stands today, surfaces E-Points as the visible
 * reward, and routes to where logging actually happens. It logs nothing.
 */

const SEEN_KEY = "gm-muster-seen";

// ponytail: placeholder daily targets (they define "Full Muster") — tune deliberately.
const TARGETS = { prospects: 7, invited: 5, presentations: 2, baseActivations: 1 };
const SALES_TARGET = 3000;

const APP_TAG: Record<EpointParamStatus["app"], { label: string; className: string }> = {
  daily: { label: "GUTGUARD DAILY", className: "bg-info/12 text-info" },
  gema: { label: "GEMA", className: "bg-brand/10 text-brand-dark dark:text-brand" },
};

function CountUp({
  value,
  duration = 900,
  delay = 0,
  money = false,
}: {
  value: number;
  duration?: number;
  delay?: number;
  money?: boolean;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const startT = performance.now() + delay;
    const tick = (now: number) => {
      if (now < startT) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startT) / duration);
      setN(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  if (money) return <>{`₱${Math.round(n).toLocaleString()}`}</>;
  return <>{Math.round(n)}</>;
}

export function MusterReminder({
  memberName,
  state,
  streak,
  bestStreak,
  monthNoZero,
  monthlyTarget,
  today,
  epoints,
  dailyUrl,
  bulletinUrl,
}: {
  memberName: string;
  state: MemberState;
  streak: number;
  bestStreak: number;
  monthNoZero: number;
  monthlyTarget: number;
  today: MusterToday;
  epoints: EpointParamStatus[];
  dailyUrl: string | null;
  bulletinUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [view, setView] = useState<"muster" | "epoints">("muster");

  useEffect(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(SEEN_KEY) === todayIso) return;
    localStorage.setItem(SEEN_KEY, todayIso);
    setOpen(true);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);

  const noZeroToday =
    today.prospects > 0 ||
    today.invited > 0 ||
    today.presentations > 0 ||
    today.baseActivations > 0 ||
    today.debriefed;

  const efforts = [
    { key: "prospects", label: "New Prospects", value: today.prospects, target: TARGETS.prospects, binary: false },
    { key: "invited", label: "Invited Today", value: today.invited, target: TARGETS.invited, binary: false },
    { key: "nozero", label: "No-Zero-Day", value: noZeroToday ? 1 : 0, target: 1, binary: true },
    { key: "presentations", label: "Daily Presentations", value: today.presentations, target: TARGETS.presentations, binary: false },
    { key: "base", label: "BASE Activations", value: today.baseActivations, target: TARGETS.baseActivations, binary: false },
    { key: "debrief", label: "Daily Debriefing", value: today.debriefed ? 1 : 0, target: 1, binary: true },
  ];

  const doneCount = efforts.filter((a) => a.value >= a.target).length;
  const fullMuster = doneCount === efforts.length;
  const remaining = efforts.length - doneCount;
  const isLapsed = state === "lapsed";
  const shownStreak = isLapsed ? bestStreak : streak;

  const epTotal = epoints.reduce((s, p) => s + p.earned, 0);
  const epMax = epoints.reduce((s, p) => s + p.max, 0);
  const epLeft = epMax - epTotal;
  const gemaUntapped = epoints
    .filter((p) => p.app === "gema" && p.earned < p.max)
    .reduce((s, p) => s + (p.max - p.earned), 0);

  const copy = {
    active: { sub: "Have a No-Zero day today.", primary: "Open Gutguard Daily" },
    lapsed: {
      sub: `Your ${bestStreak}-day streak is recoverable — log an activity to restore it.`,
      primary: "Restore streak in Daily",
    },
    recruit: { sub: "One activity a day keeps your streak alive.", primary: "Start in Gutguard Daily" },
  }[state];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily muster reminder"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl transition-all duration-500 motion-reduce:transition-none",
          shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        {view === "epoints" ? (
          <>
            {/* ---------- E-POINTS DETAIL ---------- */}
            <div className="bg-linear-to-br from-brand to-brand-dark p-5 text-white">
              <button
                type="button"
                onClick={() => setView("muster")}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" /> Back
              </button>
              <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-gold">
                E-Points this week
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-5xl font-black leading-none text-gold">
                  <CountUp value={epTotal} duration={1000} delay={100} />
                </span>
                <span className="text-sm font-bold text-blue-100">/ {epMax} possible</span>
              </div>
              <p className="mt-2 max-w-[280px] text-xs font-semibold leading-5 text-blue-100">
                Each way to earn has a weekly limit — once one&apos;s maxed, the next points come
                from trying another. <b className="text-gold">{epLeft} still up for grabs.</b>
              </p>
            </div>

            <div className="p-4">
              <div className="grid gap-2.5">
                {epoints.map((p, i) => {
                  const pct = Math.min(100, (p.earned / p.max) * 100);
                  const maxed = p.earned >= p.max;
                  const untapped = p.earned === 0;
                  const tag = APP_TAG[p.app];
                  return (
                    <div key={p.key} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-heading text-sm font-extrabold">
                            {p.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[8.5px] font-black tracking-wide",
                              tag.className,
                            )}
                          >
                            {tag.label}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-bold tabular-nums",
                            maxed && "text-success",
                          )}
                        >
                          {p.earned}
                          <span className="text-muted-foreground">/{p.max}</span>
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none",
                            maxed ? "bg-success" : "bg-gold",
                          )}
                          style={{ width: shown ? `${pct}%` : "0%", transitionDelay: `${i * 60}ms` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {maxed ? "You’ve earned all you can here this week." : p.tip}
                        </span>
                        {maxed ? (
                          <span className="shrink-0 text-[10px] font-black text-success">
                            MAXED &#10003;
                          </span>
                        ) : untapped ? (
                          <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-brand-dark dark:text-slate-900">
                            +{p.max} HERE
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 rounded-xl bg-info/8 px-3.5 py-3 text-xs font-semibold leading-5 text-foreground ring-1 ring-border/70">
                Points convert to product credit. Limits refresh every week.
              </p>

              {gemaUntapped > 0 ? (
                <Link
                  href="/member/events"
                  onClick={close}
                  className={cn(buttonVariants({ variant: "brand" }), "mt-4 w-full")}
                >
                  Earn {gemaUntapped} more at GEMA events &#8594;
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setView("muster")}
                className="mt-2 w-full py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Back to muster
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ---------- MUSTER REMINDER ---------- */}
            <div className="bg-linear-to-br from-brand to-brand-dark p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-xl font-extrabold tracking-tight">
                  Welcome, <span className="text-gold">{memberName}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setView("epoints")}
                  aria-label="E-Points, tap to see how you earn them"
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 shadow-[0_3px_10px_rgb(245_183_22/35%)] transition-transform hover:scale-105 motion-reduce:transition-none"
                >
                  <Zap className="size-4 fill-brand-dark text-brand-dark" aria-hidden="true" />
                  <span className="font-heading text-lg font-black leading-none text-brand-dark">
                    <CountUp value={epTotal} delay={150} />
                  </span>
                  <span className="text-[10px] font-black tracking-wide text-brand-dark/75">
                    PTS
                  </span>
                </button>
              </div>

              <div className="mt-2 flex items-baseline gap-2.5">
                <span className="text-lg font-bold tracking-widest text-blue-200">DAY</span>
                <span
                  className={cn(
                    "font-heading text-6xl font-black leading-none",
                    isLapsed && "text-white/40",
                  )}
                >
                  <CountUp value={shownStreak} duration={1000} delay={120} />
                </span>
                {isLapsed ? (
                  <span className="self-center rounded-full bg-gold px-2 py-0.5 text-[9px] font-black tracking-wide text-brand-dark">
                    RECOVERABLE
                  </span>
                ) : null}
              </div>

              <div className="mt-3 max-w-[290px]">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-sm font-black">
                    <CountUp value={monthNoZero} delay={220} />
                    <span className="text-xs font-bold text-blue-200">/{monthlyTarget}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-blue-100">
                    No-Zero days this month
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/18">
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-900 motion-reduce:transition-none"
                    style={{
                      width: shown ? `${Math.min(100, (monthNoZero / monthlyTarget) * 100)}%` : "0%",
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-semibold text-blue-200/80">
                  Sundays are rest days — they don&apos;t break your streak.
                </p>
              </div>

              <p className="mt-2 max-w-[280px] text-xs font-semibold leading-5 text-blue-100">
                {copy.sub}
              </p>
            </div>

            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-heading text-xs font-extrabold uppercase tracking-widest">
                  Today at a glance
                </span>
                <span className="text-[11px] font-bold text-brand">
                  {fullMuster ? "Full Muster ✓" : `${remaining} to Full Muster`}
                </span>
              </div>

              <div className="divide-y divide-border/50">
                {efforts.map((a, i) => {
                  const pct = a.binary
                    ? a.value >= 1
                      ? 100
                      : 0
                    : Math.min(100, (a.value / a.target) * 100);
                  const st = a.value >= a.target ? "done" : a.value > 0 ? "prog" : "zero";
                  return (
                    <div key={a.key} className="flex items-center gap-3 py-2.5">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          st === "done" && "bg-success",
                          st === "prog" && "bg-info",
                          st === "zero" && "border-2 border-border bg-transparent",
                        )}
                      />
                      <span className="w-[130px] shrink-0 text-[13px] font-bold">{a.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none",
                            st === "done" ? "bg-success" : "bg-info",
                          )}
                          style={{
                            width: shown ? `${pct}%` : "0%",
                            transitionDelay: `${220 + i * 80}ms`,
                          }}
                        />
                      </div>
                      <span className="min-w-[40px] shrink-0 text-right text-[13px] font-bold tabular-nums">
                        {a.binary ? (
                          <span className={a.value >= 1 ? "text-success" : "text-muted-foreground"}>
                            {a.value >= 1 ? "Yes" : "No"}
                          </span>
                        ) : (
                          <>
                            <CountUp value={a.value} duration={800} delay={220 + i * 80} />
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              /{a.target}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}

                {/* Sales — the lag outcome the effort produces, not a Full-Muster gate */}
                <div className="flex items-center gap-3 py-2.5">
                  <span className="size-2.5 shrink-0 rounded-full bg-gold" />
                  <span className="w-[130px] shrink-0 text-[13px] font-bold">
                    Sales Today{" "}
                    <span className="rounded bg-gold/16 px-1 py-0.5 align-middle text-[8px] font-black tracking-wide text-gold-dark">
                      RESULT
                    </span>
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-700 motion-reduce:transition-none"
                      style={{
                        width: shown ? `${Math.min(100, (today.sales / SALES_TARGET) * 100)}%` : "0%",
                        transitionDelay: `${220 + efforts.length * 80}ms`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-right text-[13px] font-extrabold tabular-nums">
                    <CountUp value={today.sales} delay={220 + efforts.length * 80} money />
                  </span>
                </div>
              </div>

              {bulletinUrl ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border-l-4 border-gold bg-secondary/60 px-3.5 py-3">
                  <span className="text-xs font-semibold leading-5">
                    Your squad&apos;s bulletin is on Telegram.
                  </span>
                  <a
                    href={bulletinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold text-brand hover:border-info"
                  >
                    Bulletin &#8599;
                  </a>
                </div>
              ) : null}

              {dailyUrl ? (
                <a
                  href={dailyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "brand" }), "mt-4 w-full")}
                >
                  {copy.primary} &#8594;
                </a>
              ) : (
                <Link
                  href="/member/prospects"
                  onClick={close}
                  className={cn(buttonVariants({ variant: "brand" }), "mt-4 w-full")}
                >
                  Sponsor a prospect &#8594;
                </Link>
              )}
              <button
                type="button"
                onClick={close}
                className="mt-2 w-full py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
