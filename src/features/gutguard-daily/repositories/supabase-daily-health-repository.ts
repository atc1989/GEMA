import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DailyDoseRow,
  DailyHealthRepository,
  ReminderRow,
  RepositoryResult,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

export class SupabaseDailyHealthRepository implements DailyHealthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listDoses(
    patientId: string,
    from: string,
    to: string,
  ): Promise<RepositoryResult<DailyDoseRow[]>> {
    const { data, error } = await this.supabase
      .from("gutguard_daily_doses")
      .select("*")
      .eq("patient_id", patientId)
      .gte("dose_date", from)
      .lte("dose_date", to)
      .order("dose_date", { ascending: false })
      .order("slot", { ascending: true });

    return { data: (data ?? []) as DailyDoseRow[], error };
  }

  async listReminders(patientId: string): Promise<RepositoryResult<ReminderRow[]>> {
    const { data, error } = await this.supabase
      .from("gutguard_reminders")
      .select("*")
      .eq("patient_id", patientId)
      .order("local_time", { ascending: true });

    return { data: (data ?? []) as ReminderRow[], error };
  }
}
