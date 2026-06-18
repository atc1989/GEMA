import Link from "next/link";
import { CalendarDays, Gift, Share2, Star, Ticket, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REWARD_TIERS = [
  {
    icon: Share2,
    title: "Share 5 times",
    desc: "Share your referral link to 5 friends who register for any Gutguard event.",
    reward: "1 Free Trial Blister",
    color: "text-sky-600 bg-sky-50",
  },
  {
    icon: Users,
    title: "1 friend attends",
    desc: "One friend registers and attends a live Gutguard event through your link.",
    reward: "50% Off Voucher",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Star,
    title: "Become a member",
    desc: "Enroll as a full Gutguard member to unlock pay-in rewards, rank bonuses, and the No-Zero calendar.",
    reward: "Full Rewards Unlocked",
    color: "text-amber-600 bg-amber-50",
  },
];

export default function RewardsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">Refer &amp; Earn</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Share Gutguard with friends. When they attend through your link, you both get rewarded.
        </p>
      </div>

      {/* Reward tiers */}
      <div className="grid gap-3">
        {REWARD_TIERS.map((tier, i) => (
          <Card key={tier.title} className="flex items-start gap-4 p-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tier.color}`}
            >
              <tier.icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground">
                  STEP {i + 1}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-bold">{tier.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{tier.desc}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-[11px] font-black text-brand">
                <Gift className="size-3" aria-hidden="true" />
                {tier.reward}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* How to get your referral link */}
      <Card className="grid gap-3 p-5">
        <h3 className="text-sm font-black tracking-tight">How to get your referral link</h3>
        <div className="grid gap-2 text-sm font-semibold text-muted-foreground">
          <p>
            Your referral link is tied to your registration. When you register for any Gutguard
            event, your unique pass code becomes your referral identifier.
          </p>
          <p>
            Share your event registration pass — the link your sponsor sent you — and ask friends
            to register using it. Their registration will be credited to you automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/passes"
            className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
          >
            <Ticket aria-hidden="true" />
            View my passes
          </Link>
          <Link
            href="/invite"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <CalendarDays aria-hidden="true" />
            Browse events
          </Link>
        </div>
      </Card>

      {/* Become a member CTA */}
      <Card className="border-brand/20 bg-gradient-to-br from-secondary to-background p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Star className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight">Become a member</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Unlock pay-in commissions, the No-Zero calendar, team tracking, and more.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Ask your sponsor to enroll you. Membership connects you to the full GEMA platform —
          track your team, earn on every conversion, and build your business.
        </p>
      </Card>

      <p className="text-center text-[10px] leading-4 text-muted-foreground">
        Rewards are subject to terms and conditions. Ask your sponsor for full program details.
      </p>
    </div>
  );
}
