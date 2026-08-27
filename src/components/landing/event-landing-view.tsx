import { GinhawaEmpty, GinhawaLanding } from "@/components/landing/ginhawa-landing";
import { SessionLanding } from "@/components/landing/session-landing";
import { SizzleLanding } from "@/components/landing/sizzle-landing";
import type { PublicLanding } from "@/lib/ginhawa/public-landing";
import { asLandingTemplate } from "@/lib/ginhawa/templates";

/** Pick the public layout for a landing snapshot. */
export function EventLandingView({ landing }: { landing: PublicLanding }) {
  switch (asLandingTemplate(landing.template)) {
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
