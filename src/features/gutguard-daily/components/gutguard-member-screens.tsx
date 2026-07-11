"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Droplet,
  Pencil,
  Pill,
  Play,
  Sparkles,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  completeGutGuardOnboardingAction,
  saveGutGuardDosingConfigAction,
  saveGutGuardReminderAction,
} from "@/lib/actions/gutguard-daily";
import { cn } from "@/lib/utils";
import type {
  DosingConfigRow,
  GutGuardDoseSlot,
  OnboardingProgressRow,
  ReminderRow,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

type GutGuardLocale = DosingConfigRow["locale"];

const NUDGE: Record<"morning" | "afternoon" | "evening", Record<GutGuardLocale, string>> = {
  morning: {
    en: "Good morning — time for your GutGuard.",
    tl: "Magandang umaga — oras na para sa GutGuard.",
    bis: "Maayong buntag — panahon na sa imong GutGuard.",
  },
  afternoon: {
    en: "Quick reminder — take your GutGuard today.",
    tl: "Paalala — inumin ang GutGuard mo ngayon.",
    bis: "Pahinumdom — imna ang imong GutGuard karon.",
  },
  evening: {
    en: "Sweet dreams — take your GutGuard before bed.",
    tl: "Sweet dreams — inumin ang GutGuard bago matulog.",
    bis: "Sweet dreams — imna ang GutGuard sa dili pa matulog.",
  },
};
const DISMISS: Record<GutGuardLocale, string> = { en: "Got it", tl: "Sige", bis: "Sige" };
const LOCALE_LABELS: Array<[GutGuardLocale, string]> = [
  ["en", "EN"],
  ["tl", "TL"],
  ["bis", "BIS"],
];

const SLOT_DEFS: Array<{ slot: GutGuardDoseSlot; label: string; hint: string; time: string }> = [
  { slot: "morning", label: "Morning Habit", hint: "before meals · empty stomach", time: "07:00" },
  { slot: "midday", label: "Midday Boost", hint: "after lunch", time: "12:30" },
  { slot: "dreams", label: "Sweet Dreams", hint: "before bedtime", time: "21:00" },
];

function partOfDay(hour: number) {
  return hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "afternoon" : "evening";
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${ap}`;
}

function daysBetween(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
}

function playJingle() {
  // Stand-in for the real GutGuard jingle; swap for new Audio('/gutguard-jingle.mp3').play()
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      const t0 = now + index * 0.13;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(t0);
      oscillator.stop(t0 + 0.24);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {
    /* audio blocked — silent fallback */
  }
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {
    /* ignore */
  }
}

function NudgeCard({
  title,
  body,
  dismissLabel,
  onDismiss,
}: {
  title: string;
  body?: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-linear-to-br from-brand to-brand-dark p-4 text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Droplet className="size-4 text-blue-200" aria-hidden="true" />
      </span>
      <div className="flex-1">
        <p className="font-heading text-base font-black leading-tight">{title}</p>
        {body ? <p className="mt-0.5 text-sm font-semibold text-blue-100">{body}</p> : null}
      </div>
      <Button variant="secondary" size="sm" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  );
}

function LocaleSegments({
  value,
  onChange,
}: {
  value: GutGuardLocale;
  onChange: (locale: GutGuardLocale) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {LOCALE_LABELS.map(([locale, label]) => (
        <button
          className={cn(
            "rounded-lg border border-border px-3 py-1.5 text-xs font-black transition-colors",
            value === locale
              ? "border-brand bg-brand text-white"
              : "bg-background text-muted-foreground hover:text-foreground",
          )}
          key={locale}
          onClick={() => onChange(locale)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ================= TRACKER ================= */

export function GutGuardSupplyPanel({
  config,
  today,
}: {
  config: DosingConfigRow | null;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  useEffect(() => {
    if (!config) return;
    const key = "gutguard:tracker:pop";
    const todayKey = new Date().toDateString();
    if (localStorage.getItem(key) !== todayKey) {
      setNudgeOpen(true);
      localStorage.setItem(key, todayKey);
    }
  }, [config]);

  if (!config || editing) {
    return (
      <Card>
        <p className="text-xs font-black uppercase tracking-widest text-gold">
          {config ? "Edit dosing" : "Purchase encoded ✓"}
        </p>
        <h2 className="mt-1 font-heading text-lg font-black">GutGuard Daily Tracker</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Set the dosing for this purchase. The tracker counts the days and the capsules from here.
        </p>
        <form
          action={async (formData) => {
            await saveGutGuardDosingConfigAction(formData);
            setEditing(false);
          }}
          className="mt-4 grid gap-3"
        >
          <Field label="Product">
            <Input name="product" defaultValue={config?.product ?? "SynBIOTIC+ · Start"} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capsules bought">
              <Input
                name="totalCapsules"
                type="number"
                min="1"
                defaultValue={config?.total_capsules ?? 60}
                required
              />
            </Field>
            <Field label="Capsules / day">
              <Input
                name="capsulesPerDay"
                type="number"
                min="1"
                max="9"
                defaultValue={config?.capsules_per_day ?? 2}
                required
              />
            </Field>
          </div>
          <Field label="Start date">
            <Input name="startDate" type="date" defaultValue={config?.start_date ?? today} required />
          </Field>
          <Field label="Reminder language">
            <SelectLocaleInput defaultValue={config?.locale ?? "en"} />
          </Field>
          <Button type="submit" variant="brand">
            {config ? "Save dosing" : "Start tracking"}
          </Button>
          {config ? (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null}
        </form>
      </Card>
    );
  }

  const perDay = Math.max(1, config.capsules_per_day);
  const total = Math.max(1, config.total_capsules);
  const daysElapsed = daysBetween(config.start_date);
  const protocolDay = daysElapsed + 1;
  const scheduledTaken = Math.min(total, daysElapsed * perDay);
  const remaining = Math.max(0, total - scheduledTaken);
  const daysLeft = Math.floor(remaining / perDay);
  const supplyDays = Math.floor(total / perDay);
  const pct = Math.round((remaining / total) * 100);
  const low = daysLeft <= 7 && remaining > 0;
  const out = remaining === 0;
  const timeOfDay = partOfDay(new Date().getHours());

  return (
    <div className="grid gap-3">
      {nudgeOpen ? (
        <NudgeCard
          title={NUDGE[timeOfDay][config.locale]}
          dismissLabel={DISMISS[config.locale]}
          onDismiss={() => setNudgeOpen(false)}
        />
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-3 bg-linear-to-br from-brand to-brand-dark px-4 py-3 text-white">
          <span className="font-heading text-base font-black">{config.product}</span>
          <span className="text-xs font-black text-blue-200">
            Day {protocolDay > 90 ? "90+" : protocolDay} / 90
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div
                className={cn(
                  "font-heading text-5xl font-black leading-none",
                  out ? "text-destructive" : "text-brand",
                )}
              >
                {remaining}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Capsules left
              </div>
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "font-heading text-xl font-black",
                  low || out ? "text-destructive" : "text-success",
                )}
              >
                {daysLeft} days
              </div>
              <div className="text-xs font-semibold text-muted-foreground">of supply left</div>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                out ? "bg-destructive" : low ? "bg-gold" : "bg-brand",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {scheduledTaken} of {total} taken · {perDay}/day · {supplyDays}-day supply
          </p>

          {low || out ? (
            <div
              className={cn(
                "mt-4 flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold",
                out
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-gold/50 bg-gold/10 text-foreground",
              )}
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {out
                ? "Supply finished — reorder to keep your streak going."
                : `Running low — ${daysLeft} days left. Reorder now so you don't skip.`}
            </div>
          ) : null}
        </div>
      </Card>

      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden="true" />
        Edit dosing
      </Button>
      <p className="text-xs font-medium leading-5 text-muted-foreground">
        Capsules are counted from the schedule; record doses on the right to keep the calendar exact.
      </p>
    </div>
  );
}

function SelectLocaleInput({ defaultValue }: { defaultValue: GutGuardLocale }) {
  const [locale, setLocale] = useState<GutGuardLocale>(defaultValue);
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <LocaleSegments value={locale} onChange={setLocale} />
    </>
  );
}

/* ================= REMINDERS ================= */

type SoundOption = "jingle" | "default" | "silent";
type PermissionState = NotificationPermission | "unsupported";

export function GutGuardReminderSettings({ reminders }: { reminders: ReminderRow[] }) {
  const general = useMemo(() => reminders.find((reminder) => reminder.slot === null), [reminders]);
  const [time, setTime] = useState(general?.local_time.slice(0, 5) ?? "07:00");
  const [locale, setLocale] = useState<GutGuardLocale>(general?.locale ?? "en");
  const [pushOn, setPushOn] = useState(general?.channel === "push" && general.enabled);
  const [perm, setPerm] = useState<PermissionState>("default");
  const [sound, setSound] = useState<SoundOption>("jingle");
  const [showNudge, setShowNudge] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    // ponytail: sound choice is device-local (no DB column); localStorage is enough.
    const stored = localStorage.getItem("gutguard:reminder:sound") as SoundOption | null;
    if (stored) setSound(stored);
  }, []);

  const persist = (patch: { time?: string; locale?: GutGuardLocale; pushOn?: boolean }) => {
    const next = { time, locale, pushOn, ...patch };
    if (patch.time !== undefined) setTime(patch.time);
    if (patch.locale !== undefined) setLocale(patch.locale);
    if (patch.pushOn !== undefined) setPushOn(patch.pushOn);

    const formData = new FormData();
    if (general) formData.set("id", general.id);
    formData.set("slot", "general");
    formData.set("channel", next.pushOn ? "push" : "in_app");
    formData.set("localTime", next.time);
    formData.set("timezone", general?.timezone ?? "Asia/Manila");
    formData.set("locale", next.locale);
    formData.set("enabled", "on");
    startTransition(() => saveGutGuardReminderAction(formData));
  };

  const chooseSound = (value: SoundOption) => {
    setSound(value);
    localStorage.setItem("gutguard:reminder:sound", value);
    if (value === "jingle") playJingle();
    else if (value === "default") playChime();
  };

  const togglePush = async () => {
    if (pushOn) {
      persist({ pushOn: false });
      return;
    }
    if (perm !== "unsupported" && perm !== "granted") {
      try {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result !== "granted") return;
      } catch {
        /* fall through — keep the in-app nudge */
      }
    }
    persist({ pushOn: true });
  };

  const preview = () => {
    setShowNudge(true);
    if (pushOn && sound === "jingle") playJingle();
    else if (pushOn && sound === "default") playChime();
    if (pushOn && perm === "granted") {
      try {
        new Notification("GutGuard", { body: NUDGE.morning[locale] });
      } catch {
        /* on-screen nudge still shows */
      }
    }
  };

  return (
    <div className="grid gap-3">
      {showNudge ? (
        <NudgeCard
          title={NUDGE.morning[locale]}
          body="Take it with your morning coffee."
          dismissLabel={DISMISS[locale]}
          onDismiss={() => setShowNudge(false)}
        />
      ) : null}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-black">Remind me at</p>
          <p className="text-xs font-semibold text-muted-foreground">A gentle nudge, once a day</p>
        </div>
        <Input
          className="w-32"
          type="time"
          value={time}
          onChange={(event) => persist({ time: event.target.value })}
        />
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-black">Phone notification</p>
          <p className="text-xs font-semibold text-muted-foreground">
            {perm === "denied"
              ? "Blocked — turn on notifications in browser settings"
              : perm === "unsupported"
                ? "Push added in the full build"
                : "Ping even when the app is closed"}
          </p>
        </div>
        <button
          aria-checked={pushOn}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            pushOn ? "bg-brand" : "bg-border",
          )}
          onClick={togglePush}
          role="switch"
          type="button"
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white shadow transition-all",
              pushOn ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </Card>

      {pushOn ? (
        <Card className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-sm font-black">Notification sound</p>
              <p className="text-xs font-semibold text-muted-foreground">What plays when it&apos;s time</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (sound === "jingle" ? playJingle() : sound === "default" ? playChime() : null)}
            >
              <Play aria-hidden="true" />
              Play
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["jingle", "GutGuard Jingle"],
                ["default", "Default"],
                ["silent", "Silent"],
              ] as Array<[SoundOption, string]>
            ).map(([value, label]) => (
              <button
                className={cn(
                  "rounded-xl border border-border px-2 py-2.5 text-xs font-black transition-colors",
                  sound === value
                    ? "border-brand bg-brand text-white"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
                key={value}
                onClick={() => chooseSound(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {sound === "jingle" ? (
            <p className="text-xs font-semibold text-gold">
              ♪ Your brand jingle — plays on the in-app nudge and in the GEMA app.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-black">Language</p>
          <p className="text-xs font-semibold text-muted-foreground">How the reminder reads</p>
        </div>
        <LocaleSegments value={locale} onChange={(value) => persist({ locale: value })} />
      </Card>

      <Button variant="brand" onClick={preview}>
        <BellRing aria-hidden="true" />
        Preview the reminder
      </Button>
      <p className="text-center text-xs font-semibold text-muted-foreground">Set for {to12h(time)} daily</p>
    </div>
  );
}

/* ================= ONBOARDING ================= */

type OnboardingStep = "language" | "welcome" | "start" | "setup" | "review" | "firstdose";
const STEPS: OnboardingStep[] = ["language", "welcome", "start", "setup", "review", "firstdose"];

export function GutGuardOnboardingFlow({ progress }: { progress: OnboardingProgressRow | null }) {
  const [restarted, setRestarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [tier, setTier] = useState<1 | 3>(3);
  const [locale, setLocale] = useState<GutGuardLocale>("en");
  const [status, setStatus] = useState<"new" | "taking">("new");
  const [daysTaken, setDaysTaken] = useState("");
  const [priorCaps, setPriorCaps] = useState("");
  const [stock, setStock] = useState("120");
  const [doses, setDoses] = useState<Record<GutGuardDoseSlot, number>>({ morning: 2, midday: 1, dreams: 2 });
  const [times, setTimes] = useState<Record<GutGuardDoseSlot, string>>({
    morning: "07:00",
    midday: "12:30",
    dreams: "21:00",
  });
  const [notifStatus, setNotifStatus] = useState<PermissionState>("default");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setNotifStatus(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const step = STEPS[index];
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(STEPS.length - 1, i + delta)));
  const assisted = tier === 1;

  const activeSlots = SLOT_DEFS.filter(({ slot }) => doses[slot] > 0);
  const dailyCaps = doses.morning + doses.midday + doses.dreams;
  const stockN = Math.max(0, Math.floor(Number(stock) || 0));
  const supplyDays = dailyCaps > 0 ? Math.floor(stockN / dailyCaps) : 0;
  const dayNo = (status === "taking" ? Math.max(0, Math.floor(Number(daysTaken) || 0)) : 0) + 1;
  const startOk = stockN > 0 && (status === "new" || (Number(daysTaken) > 0 && Number(priorCaps) > 0));
  const endDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + supplyDays);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  const enableNotifs = async () => {
    if (typeof Notification === "undefined") return;
    try {
      setNotifStatus(await Notification.requestPermission());
    } catch {
      /* leave as-is */
    }
  };

  const takeFirstDose = async () => {
    setSaving(true);
    try {
      await completeGutGuardOnboardingAction({
        tier: assisted ? 1 : 3,
        locale,
        stock: stockN,
        daysTaken: status === "taking" ? Math.floor(Number(daysTaken) || 0) : 0,
        caregiverConsent: assisted && consent,
        notificationsEnabled: notifStatus === "granted",
        slots: activeSlots.map(({ slot, time }) => ({ slot, capsules: doses[slot], time: times[slot] ?? time })),
      });
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  if (progress?.completed_at && !restarted && !done) {
    return (
      <Card className="mx-auto w-full max-w-md text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
        <h2 className="mt-3 font-heading text-xl font-black">Onboarding complete</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Finished {new Date(progress.completed_at).toLocaleDateString()}. Your dosing, reminders, and
          consent are saved.
        </p>
        <div className="mt-4 grid gap-2">
          <Link className={cn(buttonVariants({ variant: "brand" }))} href="/gutguard-daily">
            Enter GutGuard Daily
          </Link>
          <Button variant="ghost" onClick={() => setRestarted(true)}>
            Restart onboarding
          </Button>
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="relative mx-auto w-full max-w-md overflow-hidden text-center">
        <Confetti />
        <p className="font-heading text-xs font-black uppercase tracking-widest text-gold">
          Day {dayNo} done
        </p>
        <h2 className="mt-2 font-heading text-2xl font-black">Done!</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {Math.max(0, 90 - dayNo)} days to go — padayon, one day at a time.
        </p>
        <Link
          className={cn(buttonVariants({ variant: "brand" }), "mt-5 w-full")}
          href="/gutguard-daily"
        >
          Enter GutGuard Daily
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        {STEPS.map((name, i) => (
          <div
            className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-brand" : "bg-border")}
            key={name}
          />
        ))}
      </div>

      {assisted && step !== "language" && step !== "welcome" ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-xs font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-gold font-heading font-black text-brand-dark">
            A
          </span>
          Assisted setup — you&apos;re helping a member get started.
        </div>
      ) : null}

      {step === "language" ? (
        <Card className="text-center">
          <Sparkles className="mx-auto size-8 text-brand" aria-hidden="true" />
          <h2 className="mt-3 font-heading text-xl font-black">Choose your language</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Pumili ng language · Pilia ang pinulongan
          </p>
          <div className="mt-4 grid gap-2">
            {(
              [
                ["en", "English", "Continue in English"],
                ["tl", "Taglish", "Ituloy sa Taglish"],
                ["bis", "Bisaya", "Ipadayon sa Bisaya"],
              ] as Array<[GutGuardLocale, string, string]>
            ).map(([code, native, continueLabel]) => (
              <button
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  locale === code ? "border-brand bg-secondary" : "border-border hover:bg-muted",
                )}
                key={code}
                onClick={() => {
                  setLocale(code);
                  go(1);
                }}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg font-heading text-xs font-black",
                    locale === code ? "bg-brand text-white" : "bg-secondary text-brand",
                  )}
                >
                  {code.toUpperCase()}
                </span>
                <span>
                  <span className="block font-heading text-base font-black">{native}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{continueLabel}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {step === "welcome" ? (
        <Card className="text-center">
          <p className="text-sm font-semibold text-muted-foreground">Welcome to your</p>
          <h2 className="mt-1 font-heading text-3xl font-black text-brand">GutGuard Daily</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-muted-foreground">
            Your 90-day journey starts here. We&apos;ll set up your doses, reminders, and first win — it
            takes a minute.
          </p>
          <div className="mt-5 rounded-xl border border-border p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Setting up as
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <TierButton active={!assisted} onClick={() => setTier(3)} title="Type 3–4" sub="self-serve" />
              <TierButton active={assisted} onClick={() => setTier(1)} title="Type 1–2" sub="senior · assisted" />
            </div>
          </div>
          <Button className="mt-5 w-full" variant="brand" onClick={() => go(1)}>
            Start setup
          </Button>
        </Card>
      ) : null}

      {step === "start" ? (
        <Card>
          <StepHeading
            eyebrow="Step 1"
            title="Where are you starting?"
            sub="So we track the right day and count the supply correctly."
          />
          <p className="mt-4 text-sm font-bold">Have you started taking GutGuard?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TierButton active={status === "new"} onClick={() => setStatus("new")} title="New" sub="haven't started" />
            <TierButton
              active={status === "taking"}
              onClick={() => setStatus("taking")}
              title="Already taking"
              sub="started earlier"
            />
          </div>
          {status === "taking" ? (
            <div className="mt-3 grid grid-cols-2 gap-3 border-l-2 border-gold pl-3">
              <Field label="Days taking so far">
                <Input
                  inputMode="numeric"
                  onChange={(event) => setDaysTaken(event.target.value)}
                  placeholder="e.g. 20"
                  type="number"
                  value={daysTaken}
                />
              </Field>
              <Field label="Caps/day so far">
                <Input
                  inputMode="numeric"
                  onChange={(event) => setPriorCaps(event.target.value)}
                  placeholder="e.g. 4"
                  type="number"
                  value={priorCaps}
                />
              </Field>
            </div>
          ) : null}
          <div className="mt-3">
            <Field
              label="Capsules on hand now"
              hint={`How many you have left right now — we'll count how many days it lasts${status === "taking" ? `, and continue from Day ${dayNo}.` : "."}`}
            >
              <Input
                inputMode="numeric"
                onChange={(event) => setStock(event.target.value)}
                type="number"
                value={stock}
              />
            </Field>
          </div>
          <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={!startOk} />
        </Card>
      ) : null}

      {step === "setup" ? (
        <Card>
          <StepHeading
            eyebrow="Step 2"
            title="Doses & reminders"
            sub="How many capsules, when, and how you'll be reminded. Up to 3 a day — skip any."
          />
          <div className="mt-4 grid gap-2">
            {SLOT_DEFS.map(({ slot, label, hint }) => (
              <div className="rounded-xl border border-border p-3" key={slot}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-black">{label}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setDoses((d) => ({ ...d, [slot]: Math.max(0, d[slot] - 1) }))}
                    >
                      −
                    </Button>
                    <span className="w-5 text-center font-heading text-base font-black">{doses[slot]}</span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setDoses((d) => ({ ...d, [slot]: Math.min(3, d[slot] + 1) }))}
                    >
                      +
                    </Button>
                  </div>
                </div>
                {doses[slot] > 0 ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Remind at</span>
                    <Input
                      className="h-8 w-28"
                      onChange={(event) => setTimes((t) => ({ ...t, [slot]: event.target.value }))}
                      type="time"
                      value={times[slot]}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-semibold text-muted-foreground">
            {dailyCaps} caps/day · lasts until <b className="text-foreground">{endDate}</b> ({supplyDays} days)
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Follow your product label or your health professional&apos;s advice. Refill alerts fire as
            supply runs low and adjust if you change your dose.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div>
              <p className="font-heading text-sm font-black">Phone alerts</p>
              <p className="text-xs font-semibold text-muted-foreground">Nudges + low-supply reminders</p>
            </div>
            {notifStatus === "granted" ? (
              <span className="text-xs font-black text-success">On</span>
            ) : (
              <Button size="sm" variant="outline" onClick={enableNotifs} disabled={notifStatus === "unsupported"}>
                <Bell aria-hidden="true" />
                Enable
              </Button>
            )}
          </div>
          <StepNav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={dailyCaps === 0} />
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <StepHeading eyebrow="Step 3" title="Review & confirm" sub="Check the setup before the first dose." />
          <dl className="mt-4 grid gap-2 text-sm">
            <ReviewRow label="Protocol" value="SynBIOTIC+ · Start — 90 days" />
            <ReviewRow label="Starting" value={`Day ${dayNo}`} />
            <ReviewRow
              label="Dosing"
              value={activeSlots.map(({ slot, label }) => `${label} ${doses[slot]} (${to12h(times[slot])})`).join(" · ")}
            />
            <ReviewRow label="Supply" value={`${stockN} capsules · ~${supplyDays} days`} />
            <ReviewRow label="Language" value={LOCALE_LABELS.find(([code]) => code === locale)?.[1] ?? "EN"} />
            <ReviewRow label="Alerts" value={notifStatus === "granted" ? "Push + in-app" : "In-app"} />
          </dl>
          {assisted ? (
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-border p-3 text-xs font-semibold leading-5">
              <Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              I am this member&apos;s helper and confirm they agree to my assistance. I consent to see
              their doses and receive their reminders under the Data Privacy Act (RA 10173).
            </label>
          ) : null}
          <StepNav
            onBack={() => go(-1)}
            onNext={() => go(1)}
            nextLabel="Looks right"
            nextDisabled={assisted && !consent}
          />
        </Card>
      ) : null}

      {step === "firstdose" ? (
        <Card className="text-center">
          <p className="font-heading text-xs font-black uppercase tracking-widest text-gold">
            First {activeSlots[0]?.label ?? "dose"}
          </p>
          <h2 className="mt-2 font-heading text-2xl font-black">Log today&apos;s dose</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {doses[activeSlots[0]?.slot ?? "morning"]} capsule
            {doses[activeSlots[0]?.slot ?? "morning"] === 1 ? "" : "s"} now — this is Day {dayNo}.
          </p>
          <div className="mx-auto mt-5 flex size-24 items-center justify-center rounded-full bg-secondary">
            <Pill className="size-10 text-brand" aria-hidden="true" />
          </div>
          <Button className="mt-6 w-full" variant="brand" size="lg" onClick={takeFirstDose} disabled={saving}>
            {saving ? "Saving…" : `Day ${dayNo} — dose taken ✓`}
          </Button>
          <Button className="mt-2 w-full" variant="ghost" onClick={() => go(-1)} disabled={saving}>
            Back
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function StepHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-gold">{eyebrow}</p>
      <h2 className="mt-1 font-heading text-xl font-black">{title}</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{sub}</p>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      <Button className="flex-1" variant="brand" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

function TierButton({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      className={cn(
        "rounded-xl border p-3 text-center transition-colors",
        active ? "border-brand bg-brand text-white" : "border-border bg-background hover:bg-muted",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block font-heading text-sm font-black">{title}</span>
      <span className={cn("text-xs font-semibold", active ? "text-blue-100" : "text-muted-foreground")}>
        {sub}
      </span>
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/60 px-3 py-2">
      <dt className="shrink-0 text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

const CONFETTI_COLORS = ["#2f7fd6", "#f5b716", "#1e9e57", "#C1543C", "#9DB8DE"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        left: `${(index * 41) % 100}%`,
        background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        delay: `${(index % 8) * 0.09}s`,
        rotate: `${(index * 47) % 360}deg`,
      })),
    [],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes gg-confetti-fall {
          from { transform: translateY(-24px) rotate(0deg); opacity: 1; }
          to { transform: translateY(320px) rotate(var(--gg-rot)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .gg-confetti { display: none; } }
      `}</style>
      {pieces.map((piece, index) => (
        <span
          className="gg-confetti absolute top-0 h-2 w-1.5 rounded-[2px]"
          key={index}
          style={{
            left: piece.left,
            background: piece.background,
            animation: `gg-confetti-fall 1.6s ease-in ${piece.delay} both`,
            ["--gg-rot" as string]: piece.rotate,
          }}
        />
      ))}
    </div>
  );
}
