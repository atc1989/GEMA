import type {
  DailyDoseRow,
  DailyHealthRepository,
  ReminderRow,
  RepositoryResult,
} from "@/features/gutguard-daily/repositories/daily-health-repository";

export interface DailyHealthServiceContract {
  getDoses(patientId: string, from: string, to: string): Promise<RepositoryResult<DailyDoseRow[]>>;
  getReminders(patientId: string): Promise<RepositoryResult<ReminderRow[]>>;
}

export class DailyHealthService implements DailyHealthServiceContract {
  constructor(private readonly repository: DailyHealthRepository) {}

  getDoses(patientId: string, from: string, to: string) {
    return this.repository.listDoses(patientId, from, to);
  }

  getReminders(patientId: string) {
    return this.repository.listReminders(patientId);
  }
}
