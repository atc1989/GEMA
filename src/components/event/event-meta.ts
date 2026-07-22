import type {
  EventMode,
  EventStatus,
  EventType,
  EventVisibility,
  RegistrationStatus,
} from "@/lib/database/types";

/** Shared row shapes + badge metadata for the member events page and its client lists. */

export type MemberEventCardRow = {
  id: string;
  title: string;
  event_type: EventType;
  visibility: EventVisibility;
  mode: EventMode;
  status: EventStatus;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  online_url: string | null;
  capacity: number | null;
  description: string | null;
  speaker_name: string | null;
  registered_count: number;
  member_registration_id: string | null;
  member_registration_status: RegistrationStatus | null;
  member_pass_code: string | null;
  member_qr_payload: string | null;
};

export type HostedEventRow = {
  id: string;
  title: string;
  event_type: EventType;
  status: EventStatus;
  mode: EventMode;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
};

export const TYPE_META: Record<EventType, { label: string; className: string }> = {
  presentation: { label: "Presentation", className: "bg-sky-50 text-sky-700" },
  business: { label: "Business", className: "bg-sky-50 text-sky-700" },
  training: { label: "Training", className: "bg-emerald-50 text-success" },
  sizzle: { label: "Special", className: "bg-amber-50 text-gold-dark" },
  mentoring: { label: "Mentoring", className: "bg-amber-50 text-gold-dark" },
  fellowship: { label: "Fellowship", className: "bg-amber-50 text-gold-dark" },
  other: { label: "Event", className: "bg-slate-100 text-muted-foreground" },
};

export const VISIBILITY_META: Record<
  EventVisibility,
  { label: string; helperText: string; className: string }
> = {
  public: {
    label: "Public",
    helperText: "Anyone with the link can register.",
    className: "bg-emerald-50 text-success",
  },
  private: {
    label: "Invite-only",
    helperText: "Only people you invite can register.",
    className: "bg-slate-100 text-muted-foreground",
  },
  company_support: {
    label: "Company Support",
    helperText: "Company-wide event — requires admin approval before it's visible.",
    className: "bg-purple-50 text-purple",
  },
};

export const REG_STATUS: Record<RegistrationStatus, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-sky-50 text-sky-700" },
  attended: { label: "Attended", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "No-show", className: "bg-slate-100 text-muted-foreground" },
  converted: { label: "Converted", className: "bg-purple-50 text-purple" },
};

export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-brand" },
  published: { label: "Published", className: "bg-emerald-50 text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  completed: { label: "Completed", className: "bg-slate-100 text-muted-foreground" },
  archived: { label: "Archived", className: "bg-slate-100 text-muted-foreground" },
};
