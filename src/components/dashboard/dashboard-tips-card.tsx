"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

import { Card } from "@/components/ui/card";

const STORAGE_KEY = "gema.dashboardTipsDismissed";

export function DashboardTipsCard() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <Card className="border-info/20 bg-sky-50/70 p-4 dark:bg-sky-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-extrabold tracking-tight">
            Getting started
          </h2>
          <div className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-muted-foreground">
            <Tip text="A No-Zero Day starts when you sponsor at least one prospect today." />
            <Tip text="Share an event link so guests register under you automatically." />
            <Tip text="RSVP to events early so your QR pass is ready at check-in." />
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started tips"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "1");
            setDismissed(true);
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
