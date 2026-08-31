import { CheckupLanding } from "@/components/landing/checkup-landing";
import { GinhawaEmpty, GinhawaLanding } from "@/components/landing/ginhawa-landing";
import { SessionLanding } from "@/components/landing/session-landing";
import { SizzleLanding } from "@/components/landing/sizzle-landing";
import type { PublicLanding } from "@/lib/ginhawa/public-landing";
import { asLandingTemplate } from "@/lib/ginhawa/templates";

/** Pick the public layout for a landing snapshot. */
export function EventLandingView({
  landing,
  refCode,
}: {
  landing: PublicLanding;
  /** Raw ?ref= from the URL — the BookSheet needs it to credit the sponsor. */
  refCode?: string | null;
}) {
  switch (asLandingTemplate(landing.template)) {
    case "sizzle":
      return <SizzleLanding landing={landing} refCode={refCode} />;
    case "session":
      return <SessionLanding landing={landing} refCode={refCode} />;
    case "checkup":
      return <CheckupLanding landing={landing} refCode={refCode} />;
    case "medical":
      return <GinhawaLanding landing={landing} refCode={refCode} />;
    default:
      return <GinhawaEmpty />;
  }
}
