export type AppRole = "prospect" | "member" | "host" | "admin";
export type MemberStatus = "pending" | "active" | "suspended" | "inactive";
export type ProspectStage =
  | "new"
  | "registered"
  | "attended"
  | "followup"
  | "converted"
  | "expired";
export type EventType =
  | "presentation"
  | "business"
  | "training"
  | "sizzle"
  | "mentoring"
  | "fellowship"
  | "other";
export type EventVisibility = "public" | "private" | "company_support";
export type EventMode = "in_person" | "online" | "hybrid";
export type EventStatus =
  | "draft"
  | "published"
  | "cancelled"
  | "completed"
  | "archived";
export type RegistrationStatus =
  | "registered"
  | "cancelled"
  | "attended"
  | "no_show"
  | "converted";
export type RegistrationKind = "member" | "prospect";
export type RegistrationSource =
  | "public_invite"
  | "member_referral"
  | "member_rsvp"
  | "admin";
export type AttendanceStatus = "checked_in" | "manual_confirmed" | "voided";
export type ReferralStatus =
  | "active"
  | "claimed"
  | "expired"
  | "converted"
  | "cancelled";
export type CommissionStatus =
  | "pending"
  | "approved"
  | "paid"
  | "reversed"
  | "void";
export type NotificationChannel = "in_app" | "email" | "sms" | "push" | "webhook";
export type NotificationStatus = "queued" | "sent" | "failed" | "read" | "cancelled";

export interface Profile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: AppRole;
  isAdmin: boolean;
  canPublishEvents: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Rank {
  id: number;
  code: string;
  name: string;
  level: number;
  description: string | null;
  requirements: Record<string, unknown>;
  commissionRateBps: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  profileId: string;
  rankId: number | null;
  sponsorMemberId: string | null;
  memberCode: string;
  username: string;
  status: MemberStatus;
  joinedAt: string | null;
  activatedAt: string | null;
  noZeroCurrentStreak: number;
  noZeroBestStreak: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Prospect {
  id: string;
  profileId: string | null;
  sponsorMemberId: string | null;
  convertedMemberId: string | null;
  convertedOrderId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  stage: ProspectStage;
  source: string | null;
  attributionExpiresAt: string | null;
  consentPrivacy: boolean;
  consentMarketing: boolean;
  lastContactedAt: string | null;
  convertedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  createdByProfileId: string;
  hostMemberId: string | null;
  title: string;
  slug: string;
  eventType: EventType;
  visibility: EventVisibility;
  mode: EventMode;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  venueName: string | null;
  venueAddress: string | null;
  mapUrl: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  description: string | null;
  bannerUrl: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventSpeaker {
  id: string;
  eventId: string;
  profileId: string | null;
  memberId: string | null;
  name: string;
  roleTitle: string | null;
  photoUrl: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  profileId: string | null;
  memberId: string | null;
  prospectId: string | null;
  referralId: string | null;
  sponsorMemberId: string | null;
  registrationKind: RegistrationKind;
  status: RegistrationStatus;
  source: RegistrationSource;
  passCode: string;
  qrPayload: string;
  attendeeName: string;
  attendeePhone: string | null;
  attendeeEmail: string | null;
  consentPrivacy: boolean;
  consentMarketing: boolean;
  registeredAt: string;
  cancelledAt: string | null;
  attendedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  registrationId: string;
  memberId: string | null;
  prospectId: string | null;
  checkedInByProfileId: string | null;
  status: AttendanceStatus;
  checkedInAt: string;
  qrPayload: string | null;
  deviceId: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  refCode: string;
  referrerMemberId: string;
  referredProfileId: string | null;
  prospectId: string | null;
  eventId: string | null;
  convertedOrderId: string | null;
  status: ReferralStatus;
  sourceUrl: string | null;
  firstClickedAt: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  convertedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Genealogy {
  ancestorMemberId: string;
  descendantMemberId: string;
  depth: number;
  path: string | null;
  createdAt: string;
}

export interface Commission {
  id: string;
  earnerMemberId: string;
  sourceMemberId: string | null;
  sourceProspectId: string | null;
  referralId: string | null;
  registrationId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  productId: string | null;
  rankId: number | null;
  levelDepth: number;
  basisAmount: string;
  commissionRateBps: number;
  amount: string;
  currency: string;
  status: CommissionStatus;
  periodStart: string | null;
  periodEnd: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipientProfileId: string | null;
  recipientMemberId: string | null;
  recipientProspectId: string | null;
  eventId: string | null;
  notificationType: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  scheduledFor: string | null;
  sentAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
