import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseDailyHealthRepository } from "@/features/gutguard-daily/repositories/supabase-daily-health-repository";
import { DailyHealthService } from "@/features/gutguard-daily/services/daily-health-service";

export function createDailyHealthService(supabase: SupabaseClient) {
  return new DailyHealthService(new SupabaseDailyHealthRepository(supabase));
}
