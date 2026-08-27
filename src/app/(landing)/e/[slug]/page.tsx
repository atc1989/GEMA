import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GinhawaEmpty, GinhawaLanding } from "@/components/landing/ginhawa-landing";
import { SessionLanding } from "@/components/landing/session-landing";
import { SizzleLanding } from "@/components/landing/sizzle-landing";
import { getPublishedLandingBySlug } from "@/lib/ginhawa/load-public";
import { asLandingTemplate } from "@/lib/ginhawa/templates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getPublishedLandingBySlug(slug);
  if (!landing) {
    return {
      title: "Event landing · GEMA",
      description: "This event landing is not available.",
    };
  }
  const title = landing.title.replace(/\s+/g, " ").trim();
  const description =
    landing.heroWhat ||
    `${landing.dateLabel} ${landing.timeLabel}`.trim() ||
    "Event landing on GutGuard.";
  return {
    title: `${title} · GutGuard`,
    description,
  };
}

export default async function EventLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const landing = await getPublishedLandingBySlug(slug, ref);

  if (!landing) {
    // Distinguish unknown slug vs unpublished: 404 keeps crawlers clean.
    notFound();
  }

  const template = asLandingTemplate(landing.template);

  switch (template) {
    case "sizzle":
      return <SizzleLanding landing={landing} />;
    case "session":
      return <SessionLanding landing={landing} />;
    case "medical":
      return <GinhawaLanding landing={landing} />;
    default:
      return <GinhawaEmpty />;
  }
}
