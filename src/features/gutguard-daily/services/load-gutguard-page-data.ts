import { createDailyHealthService } from "@/features/gutguard-daily/services/create-daily-health-service";
import type { AdminOverview } from "@/features/gutguard-daily/repositories/daily-health-repository";
import type { GutGuardPageData } from "@/features/gutguard-daily/components/gutguard-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getGutGuardMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
    today: formatLocalDate(now),
    label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export async function loadGutGuardPageData(profileId: string): Promise<GutGuardPageData> {
  const supabase = await createSupabaseServerClient();
  const service = createDailyHealthService(supabase);
  const range = getGutGuardMonthRange();

  const [doses, reminders, onboarding, journeyMessages, community] = await Promise.all([
    service.getDoses(profileId, range.from, range.to),
    service.getReminders(profileId),
    service.getOnboardingProgress(profileId),
    service.getJourneyMessages(profileId),
    service.getCommunityOverview(profileId),
  ]);

  const error =
    doses.error ??
    reminders.error ??
    onboarding.error ??
    journeyMessages.error ??
    community.error;

  if (error) throw error;

  return {
    doses: doses.data ?? [],
    reminders: reminders.data ?? [],
    onboarding: onboarding.data ?? null,
    journeyMessages: journeyMessages.data ?? [],
    careRelationships: community.data?.careRelationships ?? [],
    teams: community.data?.teams ?? [],
    teamMembers: community.data?.teamMembers ?? [],
    monthLabel: range.label,
    today: range.today,
  };
}

export async function loadGutGuardAdminOverview(): Promise<AdminOverview> {
  const supabase = await createSupabaseServerClient();
  const service = createDailyHealthService(supabase);
  const overview = await service.getAdminOverview();

  if (overview.error) throw overview.error;
  if (!overview.data) throw new Error("Unable to load GutGuard admin overview.");
  return overview.data;
}
