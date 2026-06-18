import Link from "next/link";
import { CalendarDays, Gift, ShieldCheck, Ticket, Users, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WHY_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Science-backed program",
    desc: "15 years of research across 7 institutions. ISO-certified and FDA-registered.",
  },
  {
    icon: Users,
    title: "Community of builders",
    desc: "Join a growing network of health advocates and business partners across the country.",
  },
  {
    icon: Zap,
    title: "Real results, real people",
    desc: "Thousands of members track their progress every day using the No-Zero system.",
  },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "Attend a live event",
    desc: "Register for a free forum near you. Get your QR pass and show up — that's your first step.",
  },
  {
    n: "02",
    title: "Experience the product",
    desc: "Learn about gut health, inflammation, and how the protocol works at the cellular level.",
  },
  {
    n: "03",
    title: "Share & earn rewards",
    desc: "Invite friends to events using your referral link. Earn rewards when they attend and convert.",
  },
  {
    n: "04",
    title: "Become a member",
    desc: "Ready to build? Your sponsor can enroll you in minutes. Unlock the full member experience.",
  },
];

export default function DiscoverPage() {
  return (
    <div className="grid gap-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Welcome</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Discover Gutguard</h2>
        <p className="mt-2 text-sm leading-6 text-blue-100">
          See the science, the proof, and real results — then reserve your seat at a live event.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/invite"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-white text-brand hover:bg-blue-50",
            )}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Browse events
          </Link>
          <Link
            href="/rewards"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-white/30 bg-transparent text-white hover:bg-white/10",
            )}
          >
            <Gift className="size-4" aria-hidden="true" />
            Refer &amp; earn
          </Link>
        </div>
      </div>

      {/* Why trust */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
          Why Gutguard
        </h3>
        <div className="mt-3 grid gap-3">
          {WHY_ITEMS.map((item) => (
            <Card key={item.title} className="flex items-start gap-4 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
                <item.icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
          How it works
        </h3>
        <div className="mt-3 grid gap-3">
          {HOW_STEPS.map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-black text-brand">
                {step.n}
              </div>
              <div className="pt-1">
                <p className="text-sm font-bold">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Card className="p-5 text-center">
        <p className="text-sm font-black tracking-tight">Ready to experience it?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reserve your seat at a live Gutguard event — it&apos;s free.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/invite" className={cn(buttonVariants({ variant: "brand" }))}>
            <CalendarDays aria-hidden="true" />
            Browse events
          </Link>
          <Link href="/passes" className={cn(buttonVariants({ variant: "outline" }))}>
            <Ticket aria-hidden="true" />
            View my passes
          </Link>
        </div>
      </Card>

      <p className="text-center text-[10px] leading-4 text-muted-foreground">
        FDA-registered · CPR No. FR-40000015571456 · IG International Corp.
        <br />
        Educational wellness program. Not intended to diagnose, treat, cure, or prevent any disease.
      </p>
    </div>
  );
}
