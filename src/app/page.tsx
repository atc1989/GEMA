import Link from "next/link";
import { CalendarDays, LayoutDashboard, PlayCircle, Settings } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { EventCard } from "@/components/event/event-card";
import { RegistrationCard } from "@/components/event/registration-card";
import { QRCard } from "@/components/qr/qr-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const surfaces = [
  {
    href: "/invite",
    label: "Prospect",
    description: "Public invite and QR registration shell",
  },
  {
    href: "/dashboard",
    label: "Member",
    description: "Authenticated dashboard navigation shell",
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Event management workspace shell",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-background px-4 py-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="rounded-2xl bg-linear-to-br from-brand to-brand-dark px-5 py-6 text-white shadow-[0_18px_50px_rgb(14_34_73/18%)]">
          <div className="text-xs font-bold uppercase tracking-wide text-blue-100">
            GEMA UI Foundation
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Shared shell and design system
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
            Mobile-first route shells, navigation structures, Tailwind tokens,
            and reusable components converted from the prototypes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {surfaces.map((surface) => (
              <Link
                className={cn(buttonVariants({ variant: "soft" }))}
                href={surface.href}
                key={surface.href}
              >
                {surface.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <DashboardCard
            icon={LayoutDashboard}
            label="Route groups"
            value="3"
            helper="Public, member, admin"
          />
          <DashboardCard
            icon={PlayCircle}
            label="Components"
            value="8"
            helper="Reusable UI primitives"
            tone="success"
          />
          <DashboardCard
            icon={Settings}
            label="Features"
            value="0"
            helper="Foundation only"
            tone="gold"
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <EventCard
            capacity={30}
            icon={CalendarDays}
            meta="Saturday, 10:00 AM"
            registered={12}
            title="Saturday Product Presentation"
            venue="Davao Hub"
          />
          <RegistrationCard
            description="A shared registration surface for RSVP, prospect signup, and pass issuance later."
            title="Registration Card"
          />
        </section>

        <QRCard
          code="GEMA-QR-FOUNDATION"
          description="Visual QR card component only. Real QR generation and scanning will be wired in feature work."
          title="QR Pass Foundation"
        />
      </div>
    </main>
  );
}
