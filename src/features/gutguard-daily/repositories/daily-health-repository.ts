import type { PostgrestError } from "@supabase/supabase-js";

export type RepositoryResult<T> = {
  data: T | null;
  error: PostgrestError | Error | null;
};

export type GutGuardDoseSlot = "morning" | "midday" | "dreams";
export type GutGuardDoseStatus = "scheduled" | "taken" | "skipped" | "missed";
export type GutGuardReminderChannel = "in_app" | "push" | "sms" | "messenger" | "viber" | "call";
export type GutGuardJourneyStatus = "pending" | "sent" | "failed" | "dismissed";
export type GutGuardRelationshipStatus = "pending" | "active" | "revoked";
export type GutGuardTeamMemberRole = "member" | "caregiver" | "team_lead";

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

export type JourneyMessageRow = {
  id: string;
  patient_id: string;
  assigned_to: string | null;
  created_by: string;
  protocol_day: number | null;
  message_type: string;
  channel: GutGuardReminderChannel;
  body: string;
  scheduled_for: string | null;
  sent_at: string | null;
  status: GutGuardJourneyStatus;
  created_at: string;
  updated_at: string;
};

export type OnboardingProgressRow = {
  patient_id: string;
  current_step: string;
  completed_steps: string[];
  tier: number | null;
  default_channel: GutGuardReminderChannel | null;
  helper_profile_id: string | null;
  consent_caregiver_at: string | null;
  consent_leader_proof_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareRelationshipRow = {
  id: string;
  patient_id: string;
  caregiver_id: string;
  status: GutGuardRelationshipStatus;
  can_view_doses: boolean;
  can_record_doses: boolean;
  can_manage_reminders: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TeamRow = {
  id: string;
  name: string;
  lead_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TeamMemberRow = {
  id: string;
  team_id: string;
  profile_id: string;
  member_role: GutGuardTeamMemberRole;
  joined_at: string;
  left_at: string | null;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
};

export type ProfileSummaryRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_admin: boolean;
  can_publish_events: boolean;
};

export type CommunityOverview = {
  careRelationships: CareRelationshipRow[];
  teams: TeamRow[];
  teamMembers: TeamMemberRow[];
};

export type AdminOverview = {
  doseCount: number;
  reminderCount: number;
  journeyCount: number;
  onboardingCount: number;
  careRelationshipCount: number;
  teamCount: number;
  auditLogs: AuditLogRow[];
};

export interface DailyHealthRepository {
  listDoses(patientId: string, from: string, to: string): Promise<RepositoryResult<DailyDoseRow[]>>;
  upsertDose(input: Partial<DailyDoseRow>): Promise<RepositoryResult<DailyDoseRow>>;
  updateDose(id: string, input: Partial<DailyDoseRow>): Promise<RepositoryResult<DailyDoseRow>>;
  listReminders(patientId: string): Promise<RepositoryResult<ReminderRow[]>>;
  createReminder(input: Partial<ReminderRow>): Promise<RepositoryResult<ReminderRow>>;
  updateReminder(id: string, input: Partial<ReminderRow>): Promise<RepositoryResult<ReminderRow>>;
  deleteReminder(id: string): Promise<RepositoryResult<void>>;
  getOnboardingProgress(patientId: string): Promise<RepositoryResult<OnboardingProgressRow | null>>;
  upsertOnboardingProgress(input: Partial<OnboardingProgressRow>): Promise<RepositoryResult<OnboardingProgressRow>>;
  listJourneyMessages(patientId: string): Promise<RepositoryResult<JourneyMessageRow[]>>;
  createJourneyMessage(input: Partial<JourneyMessageRow>): Promise<RepositoryResult<JourneyMessageRow>>;
  updateJourneyMessage(id: string, input: Partial<JourneyMessageRow>): Promise<RepositoryResult<JourneyMessageRow>>;
  getCommunityOverview(profileId: string): Promise<RepositoryResult<CommunityOverview>>;
  createCareRelationship(input: Partial<CareRelationshipRow>): Promise<RepositoryResult<CareRelationshipRow>>;
  updateCareRelationship(id: string, input: Partial<CareRelationshipRow>): Promise<RepositoryResult<CareRelationshipRow>>;
  createTeam(input: Partial<TeamRow>): Promise<RepositoryResult<TeamRow>>;
  addTeamMember(input: Partial<TeamMemberRow>): Promise<RepositoryResult<TeamMemberRow>>;
  getAdminOverview(): Promise<RepositoryResult<AdminOverview>>;
}
