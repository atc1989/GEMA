import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-[400px] shrink-0 flex-col justify-between overflow-hidden bg-linear-to-br from-brand to-brand-dark p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-28 -top-28 size-[380px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-36 -left-36 size-[480px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute bottom-32 right-0 size-48 rounded-full border border-white/[0.07]" />

        {/* Logo */}
        <div>
          <div className="font-heading flex size-11 items-center justify-center rounded-[10px_10px_18px_18px] border-2 border-gold bg-white/15 text-base font-extrabold backdrop-blur-sm">
            G
          </div>
          <div className="font-heading mt-4 text-2xl font-extrabold tracking-tight">GEMA</div>
          <div className="mt-0.5 text-sm font-semibold text-blue-200">
            Group Event Management App
          </div>
        </div>

        {/* Headline */}
        <div className="max-w-[280px]">
          <div className="font-heading mb-3 text-[10px] font-bold uppercase tracking-widest text-blue-300">
            Platform
          </div>
          <h2 className="font-heading text-[28px] font-extrabold leading-tight tracking-tight">
            Grow your network,
            <br />
            track your earnings.
          </h2>
          <p className="mt-4 text-sm font-medium leading-6 text-blue-100">
            Manage events, invite prospects, and earn multi-level commissions — all in one place.
          </p>
        </div>

        {/* Feature list */}
        <ul className="grid gap-3">
          {[
            "QR attendance check-in",
            "Multi-level commission tracking",
            "Referral links & invite management",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm font-semibold text-blue-100">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <span className="size-1.5 rounded-full bg-gold" />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#eef2f7] px-4 py-10">
        {/* Mobile brand mark */}
        <div className="mb-8 flex flex-col items-center gap-1.5 lg:hidden">
          <div className="font-heading flex size-14 items-center justify-center rounded-[12px_12px_22px_22px] border-2 border-gold bg-linear-to-br from-info to-brand-dark text-xl font-extrabold text-white shadow-[0_8px_24px_rgb(31_93_153/30%)]">
            G
          </div>
          <div className="font-heading mt-1 text-xl font-extrabold tracking-tight">GEMA</div>
          <div className="text-xs font-medium text-muted-foreground">
            Group Event Management App
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-5 text-center lg:text-left">
            <h1 className="font-heading text-[22px] font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{subtitle}</p>
          </div>

          <Card className="p-6">{children}</Card>

          {footer ? (
            <div className="mt-5 text-center text-sm font-medium text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
