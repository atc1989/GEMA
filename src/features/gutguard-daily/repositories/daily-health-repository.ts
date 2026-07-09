import type { PostgrestError } from "@supabase/supabase-js";

export type RepositoryResult<T> = {
  data: T | null;
  error: PostgrestError | Error | null;
};

export type GutGuardDoseSlot = "morning" | "midday" | "dreams";
export type GutGuardDoseStatus = "scheduled" | "taken" | "skipped" | "missed";
export type GutGuardReminderChannel = "in_app" | "push" | "sms" | "messenger" | "viber" | "call";

export type DailyDoseRow = {
  id: string;
  patient_id: string;
  dose_date: string;
  slot: GutGuardDoseSlot;
  capsules: number;
  status: GutGuardDoseStatus;
  taken_at: string | null;
  proof_path: string | null;
  recorded_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderRow = {
  id: string;
  patient_id: string;
  created_by: string;
  slot: GutGuardDoseSlot | null;
  channel: GutGuardReminderChannel;
  local_time: string;
  timezone: string;
  days_of_week: number[];
  locale: "en" | "tl" | "bis";
  enabled: boolean;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface DailyHealthRepository {
  listDoses(patientId: string, from: string, to: string): Promise<RepositoryResult<DailyDoseRow[]>>;
  listReminders(patientId: string): Promise<RepositoryResult<ReminderRow[]>>;
}
