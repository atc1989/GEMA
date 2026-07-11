import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminOverview,
  CareRelationshipRow,
  DailyDoseRow,
  DailyHealthRepository,
  DosingConfigRow,
  JourneyMessageRow,
  OnboardingProgressRow,
  ReminderRow,
  RepositoryResult,
  TeamMemberRow,
  TeamRow,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

export class SupabaseDailyHealthRepository implements DailyHealthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listDoses(patientId: string, from: string, to: string) {
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

  async upsertDose(input: Partial<DailyDoseRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_daily_doses")
      .upsert(input, { onConflict: "patient_id,dose_date,slot" })
      .select("*")
      .single();

    return { data: data as DailyDoseRow | null, error };
  }

  async updateDose(id: string, input: Partial<DailyDoseRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_daily_doses")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    return { data: data as DailyDoseRow | null, error };
  }

  async listReminders(patientId: string) {
    const { data, error } = await this.supabase
      .from("gutguard_reminders")
      .select("*")
      .eq("patient_id", patientId)
      .order("local_time", { ascending: true });

    return { data: (data ?? []) as ReminderRow[], error };
  }

  async createReminder(input: Partial<ReminderRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_reminders")
      .insert(input)
      .select("*")
      .single();

    return { data: data as ReminderRow | null, error };
  }

  async updateReminder(id: string, input: Partial<ReminderRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_reminders")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    return { data: data as ReminderRow | null, error };
  }

  async deleteReminder(id: string): Promise<RepositoryResult<void>> {
    const { error } = await this.supabase.from("gutguard_reminders").delete().eq("id", id);
    return { data: null, error };
  }

  async getDosingConfig(patientId: string) {
    const { data, error } = await this.supabase
      .from("gutguard_dosing_config")
      .select("*")
      .eq("patient_id", patientId)
      .maybeSingle();

    // ponytail: tolerate a missing table so pages keep working before the
    // gutguard_dosing_config.sql migration has been applied.
    if (error && error.code === "42P01") return { data: null, error: null };
    return { data: data as DosingConfigRow | null, error };
  }

  async upsertDosingConfig(input: Partial<DosingConfigRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_dosing_config")
      .upsert(input, { onConflict: "patient_id" })
      .select("*")
      .single();

    return { data: data as DosingConfigRow | null, error };
  }

  async getOnboardingProgress(patientId: string) {
    const { data, error } = await this.supabase
      .from("gutguard_onboarding_progress")
      .select("*")
      .eq("patient_id", patientId)
      .maybeSingle();

    return { data: data as OnboardingProgressRow | null, error };
  }

  async upsertOnboardingProgress(input: Partial<OnboardingProgressRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_onboarding_progress")
      .upsert(input, { onConflict: "patient_id" })
      .select("*")
      .single();

    return { data: data as OnboardingProgressRow | null, error };
  }

  async listJourneyMessages(patientId: string) {
    const { data, error } = await this.supabase
      .from("gutguard_journey_messages")
      .select("*")
      .eq("patient_id", patientId)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    return { data: (data ?? []) as JourneyMessageRow[], error };
  }

  async createJourneyMessage(input: Partial<JourneyMessageRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_journey_messages")
      .insert(input)
      .select("*")
      .single();

    return { data: data as JourneyMessageRow | null, error };
  }

  async updateJourneyMessage(id: string, input: Partial<JourneyMessageRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_journey_messages")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    return { data: data as JourneyMessageRow | null, error };
  }

  async getCommunityOverview(profileId: string) {
    const [careRelationships, teams, teamMembers] = await Promise.all([
      this.supabase
        .from("gutguard_care_relationships")
        .select("*")
        .or(`patient_id.eq.${profileId},caregiver_id.eq.${profileId}`)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("gutguard_teams")
        .select("*")
        .order("created_at", { ascending: false }),
      this.supabase
        .from("gutguard_team_members")
        .select("*")
        .is("left_at", null)
        .order("joined_at", { ascending: false }),
    ]);

    const error = careRelationships.error ?? teams.error ?? teamMembers.error;

    return {
      data: {
        careRelationships: (careRelationships.data ?? []) as CareRelationshipRow[],
        teams: (teams.data ?? []) as TeamRow[],
        teamMembers: (teamMembers.data ?? []) as TeamMemberRow[],
      },
      error,
    };
  }

  async createCareRelationship(input: Partial<CareRelationshipRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_care_relationships")
      .insert(input)
      .select("*")
      .single();

    return { data: data as CareRelationshipRow | null, error };
  }

  async updateCareRelationship(id: string, input: Partial<CareRelationshipRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_care_relationships")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    return { data: data as CareRelationshipRow | null, error };
  }

  async createTeam(input: Partial<TeamRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_teams")
      .insert(input)
      .select("*")
      .single();

    return { data: data as TeamRow | null, error };
  }

  async addTeamMember(input: Partial<TeamMemberRow>) {
    const { data, error } = await this.supabase
      .from("gutguard_team_members")
      .insert(input)
      .select("*")
      .single();

    return { data: data as TeamMemberRow | null, error };
  }

  async getAdminOverview(): Promise<RepositoryResult<AdminOverview>> {
    const [
      doseCount,
      reminderCount,
      journeyCount,
      onboardingCount,
      careRelationshipCount,
      teamCount,
      auditLogs,
    ] = await Promise.all([
      this.supabase.from("gutguard_daily_doses").select("id", { count: "exact", head: true }),
      this.supabase.from("gutguard_reminders").select("id", { count: "exact", head: true }),
      this.supabase.from("gutguard_journey_messages").select("id", { count: "exact", head: true }),
      this.supabase.from("gutguard_onboarding_progress").select("patient_id", { count: "exact", head: true }),
      this.supabase.from("gutguard_care_relationships").select("id", { count: "exact", head: true }),
      this.supabase.from("gutguard_teams").select("id", { count: "exact", head: true }),
      this.supabase
        .from("gutguard_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const error =
      doseCount.error ??
      reminderCount.error ??
      journeyCount.error ??
      onboardingCount.error ??
      careRelationshipCount.error ??
      teamCount.error ??
      auditLogs.error;

    return {
      data: {
        doseCount: doseCount.count ?? 0,
        reminderCount: reminderCount.count ?? 0,
        journeyCount: journeyCount.count ?? 0,
        onboardingCount: onboardingCount.count ?? 0,
        careRelationshipCount: careRelationshipCount.count ?? 0,
        teamCount: teamCount.count ?? 0,
        auditLogs: (auditLogs.data ?? []) as AdminOverview["auditLogs"],
      },
      error,
    };
  }
}
