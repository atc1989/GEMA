import type {
  CareRelationshipRow,
  DailyDoseRow,
  DailyHealthRepository,
  DosingConfigRow,
  JourneyMessageRow,
  OnboardingProgressRow,
  ReminderRow,
  TeamMemberRow,
  TeamRow,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

export class DailyHealthService {
  constructor(private readonly repository: DailyHealthRepository) {}

  getDoses(patientId: string, from: string, to: string) {
    return this.repository.listDoses(patientId, from, to);
  }

  recordDose(input: Partial<DailyDoseRow>) {
    return this.repository.upsertDose(input);
  }

  changeDose(id: string, input: Partial<DailyDoseRow>) {
    return this.repository.updateDose(id, input);
  }

  getReminders(patientId: string) {
    return this.repository.listReminders(patientId);
  }

  createReminder(input: Partial<ReminderRow>) {
    return this.repository.createReminder(input);
  }

  changeReminder(id: string, input: Partial<ReminderRow>) {
    return this.repository.updateReminder(id, input);
  }

  deleteReminder(id: string) {
    return this.repository.deleteReminder(id);
  }

  getDosingConfig(patientId: string) {
    return this.repository.getDosingConfig(patientId);
  }

  saveDosingConfig(input: Partial<DosingConfigRow>) {
    return this.repository.upsertDosingConfig(input);
  }

  getOnboardingProgress(patientId: string) {
    return this.repository.getOnboardingProgress(patientId);
  }

  saveOnboardingProgress(input: Partial<OnboardingProgressRow>) {
    return this.repository.upsertOnboardingProgress(input);
  }

  getJourneyMessages(patientId: string) {
    return this.repository.listJourneyMessages(patientId);
  }

  createJourneyMessage(input: Partial<JourneyMessageRow>) {
    return this.repository.createJourneyMessage(input);
  }

  changeJourneyMessage(id: string, input: Partial<JourneyMessageRow>) {
    return this.repository.updateJourneyMessage(id, input);
  }

  getCommunityOverview(profileId: string) {
    return this.repository.getCommunityOverview(profileId);
  }

  createCareRelationship(input: Partial<CareRelationshipRow>) {
    return this.repository.createCareRelationship(input);
  }

  changeCareRelationship(id: string, input: Partial<CareRelationshipRow>) {
    return this.repository.updateCareRelationship(id, input);
  }

  createTeam(input: Partial<TeamRow>) {
    return this.repository.createTeam(input);
  }

  addTeamMember(input: Partial<TeamMemberRow>) {
    return this.repository.addTeamMember(input);
  }

  getAdminOverview() {
    return this.repository.getAdminOverview();
  }
}
