import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventLandingView } from "@/components/landing/event-landing-view";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getPreviewLandingBySlug } from "@/lib/ginhawa/load-public";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getPreviewLandingBySlug(slug);
  if (!landing) {
    return {
      title: "Landing preview · GEMA",
      robots: { index: false, follow: false },
    };
  }
  const title = landing.title.replace(/\s+/g, " ").trim();
  return {
    title: `Preview · ${title} · Gutguard`,
    robots: { index: false, follow: false },
  };
}

/** Host/admin-only draft preview. Not indexed; not a public share URL. */
export default async function EventLandingPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/e/${slug}/preview`)}`);
  }

  const landing = await getPreviewLandingBySlug(slug);
  if (!landing) notFound();

  return (
    <>
      <div
        role="status"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "#0f172a",
          color: "#f8fafc",
          padding: "0.65rem 1rem",
          textAlign: "center",
          fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
          fontSize: "0.85rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        Draft preview — not public. Guests only see this after the landing is published.
      </div>
      <EventLandingView landing={landing} />
    </>
  );
}
