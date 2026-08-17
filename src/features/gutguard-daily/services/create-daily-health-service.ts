import type { GemaClient } from "@/lib/supabase/types";

import { SupabaseDailyHealthRepository } from "@/features/gutguard-daily/repositories/supabase-daily-health-repository";
import { DailyHealthService } from "@/features/gutguard-daily/services/daily-health-service";

export function createDailyHealthService(supabase: GemaClient) {
  return new DailyHealthService(new SupabaseDailyHealthRepository(supabase));
}
