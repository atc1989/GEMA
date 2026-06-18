# GEMA Supabase Data Architecture

This design normalizes the GEMA Member and Prospect prototypes into one
Supabase-backed model for public registration, authenticated member activity,
admin event management, MLM genealogy, referral attribution, QR check-ins,
commission calculation, and notifications.

## Existing Supabase Project

The current Supabase project already has `profiles`, `products`, `orders`,
`order_items`, and `addresses`. Do not run `supabase/schema.sql` directly on
that project because it is a fresh-database schema.

Use `supabase/gema_existing_project_migration.sql` instead. It preserves the
existing commerce tables, extends `profiles` with GEMA role fields, and links
GEMA conversion/commission records to `orders`, `order_items`, and `products`.

Existing table usage:
- `profiles`: remains the auth/user identity table; GEMA adds `role`,
  `is_admin`, `avatar_url`, and `last_seen_at`.
- `products`: remains the product catalog; commissions can reference
  `commissions.product_id`.
- `orders`: remains the purchase/pay-in source of truth; referrals,
  prospects, and commissions can reference converted orders.
- `order_items`: remains product-level purchase detail; commissions can
  reference item-level earnings when needed.
- `addresses`: remains shipping/customer address data. Event venues stay on
  `events` for now because the existing address shape is commerce-oriented.

## Table Design

### profiles
Purpose: one row per Supabase Auth user; shared identity for prospects, members, hosts, and admins.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| email | citext |
| full_name | text |
| phone | text |
| avatar_url | text |
| role | app_role |
| is_admin | boolean |
| last_seen_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `id -> auth.users(id)`
Indexes: `role`, partial `phone`, unique `email`

### ranks
Purpose: rank catalog used for member progression and commission rules.

Columns:
| Column | Type |
| --- | --- |
| id | smallserial |
| code | text |
| name | text |
| level | integer |
| description | text |
| requirements | jsonb |
| commission_rate_bps | integer |
| active | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: none
Indexes: unique `code`, unique `level`

### members
Purpose: authenticated business/member account with rank, sponsor, member code, username, and No-Zero counters.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| profile_id | uuid |
| rank_id | smallint |
| sponsor_member_id | uuid |
| member_code | text |
| username | citext |
| status | member_status |
| joined_at | timestamptz |
| activated_at | timestamptz |
| no_zero_current_streak | integer |
| no_zero_best_streak | integer |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `profile_id -> profiles(id)`, `rank_id -> ranks(id)`, `sponsor_member_id -> members(id)`
Indexes: unique `profile_id`, unique `member_code`, unique `username`, `sponsor_member_id`, `rank_id`, `status`

### prospects
Purpose: unauthenticated or pre-member guest/contact, including funnel stage and sponsor attribution.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| profile_id | uuid |
| sponsor_member_id | uuid |
| converted_member_id | uuid |
| full_name | text |
| phone | text |
| email | citext |
| stage | prospect_stage |
| source | text |
| attribution_expires_at | timestamptz |
| consent_privacy | boolean |
| consent_marketing | boolean |
| last_contacted_at | timestamptz |
| converted_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `profile_id -> profiles(id)`, `sponsor_member_id -> members(id)`, `converted_member_id -> members(id)`
Indexes: unique `profile_id`, unique `converted_member_id`, `(sponsor_member_id, stage)`, partial `email`, partial `phone`

### events
Purpose: public/private event records for invite landing pages, member RSVP, admin management, online/in-person metadata, capacity, and lifecycle.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| created_by_profile_id | uuid |
| host_member_id | uuid |
| title | text |
| slug | text |
| event_type | event_type |
| visibility | event_visibility |
| mode | event_mode |
| status | event_status |
| starts_at | timestamptz |
| ends_at | timestamptz |
| timezone | text |
| venue_name | text |
| venue_address | text |
| map_url | text |
| online_url | text |
| capacity | integer |
| description | text |
| banner_url | text |
| cancelled_at | timestamptz |
| completed_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `created_by_profile_id -> profiles(id)`, `host_member_id -> members(id)`
Indexes: unique `slug`, `(status, starts_at)`, partial public published starts index, `host_member_id`, `created_by_profile_id`, `event_type`

### event_speakers
Purpose: normalized speakers per event; supports multiple speakers and optional linkage to profiles/members.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| event_id | uuid |
| profile_id | uuid |
| member_id | uuid |
| name | text |
| role_title | text |
| photo_url | text |
| sort_order | integer |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `event_id -> events(id)`, `profile_id -> profiles(id)`, `member_id -> members(id)`
Indexes: `(event_id, sort_order)`, partial `member_id`

### referrals
Purpose: referral link/code lifecycle and attribution from member share link to prospect, event registration, and conversion.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| ref_code | text |
| referrer_member_id | uuid |
| referred_profile_id | uuid |
| prospect_id | uuid |
| event_id | uuid |
| status | referral_status |
| source_url | text |
| first_clicked_at | timestamptz |
| claimed_at | timestamptz |
| expires_at | timestamptz |
| converted_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `referrer_member_id -> members(id)`, `referred_profile_id -> profiles(id)`, `prospect_id -> prospects(id)`, `event_id -> events(id)`
Indexes: unique `ref_code`, `(referrer_member_id, status)`, partial `prospect_id`, partial `event_id`, partial active `expires_at`

### event_registrations
Purpose: event RSVP/registration and QR pass issuance for both members and prospects.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| event_id | uuid |
| profile_id | uuid |
| member_id | uuid |
| prospect_id | uuid |
| referral_id | uuid |
| sponsor_member_id | uuid |
| registration_kind | registration_kind |
| status | registration_status |
| source | registration_source |
| pass_code | text |
| qr_payload | text |
| attendee_name | text |
| attendee_phone | text |
| attendee_email | citext |
| consent_privacy | boolean |
| consent_marketing | boolean |
| registered_at | timestamptz |
| cancelled_at | timestamptz |
| attended_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `event_id -> events(id)`, `profile_id -> profiles(id)`, `member_id -> members(id)`, `prospect_id -> prospects(id)`, `referral_id -> referrals(id)`, `sponsor_member_id -> members(id)`
Indexes: unique `pass_code`, unique `qr_payload`, partial unique `(event_id, member_id)`, partial unique `(event_id, prospect_id)`, `(event_id, status)`, partial `member_id`, partial `prospect_id`, partial `sponsor_member_id`, `registered_at desc`

### attendance_records
Purpose: immutable-ish event check-in record from QR scan or manual confirmation; drives No-Zero and prospect stage updates.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| event_id | uuid |
| registration_id | uuid |
| member_id | uuid |
| prospect_id | uuid |
| checked_in_by_profile_id | uuid |
| status | attendance_status |
| checked_in_at | timestamptz |
| qr_payload | text |
| device_id | text |
| notes | text |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `event_id -> events(id)`, `registration_id -> event_registrations(id)`, `member_id -> members(id)`, `prospect_id -> prospects(id)`, `checked_in_by_profile_id -> profiles(id)`
Indexes: unique `registration_id`, `(event_id, checked_in_at desc)`, partial `member_id`, partial `prospect_id`, `checked_in_by_profile_id`

### genealogy
Purpose: closure table for MLM tree queries at scale; each member has a depth-0 self row and ancestor rows for uplines.

Columns:
| Column | Type |
| --- | --- |
| ancestor_member_id | uuid |
| descendant_member_id | uuid |
| depth | integer |
| path | ltree |
| created_at | timestamptz |

Primary key: `(ancestor_member_id, descendant_member_id)`
Foreign keys: `ancestor_member_id -> members(id)`, `descendant_member_id -> members(id)`
Indexes: `(descendant_member_id, depth)`, `(ancestor_member_id, depth)`

### commissions
Purpose: calculated commission ledger for pay-ins, conversions, referral rewards, rank-based rates, reversals, approvals, and payouts.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| earner_member_id | uuid |
| source_member_id | uuid |
| source_prospect_id | uuid |
| referral_id | uuid |
| registration_id | uuid |
| rank_id | smallint |
| level_depth | integer |
| basis_amount | numeric(12,2) |
| commission_rate_bps | integer |
| amount | numeric(12,2) |
| currency | char(3) |
| status | commission_status |
| period_start | date |
| period_end | date |
| approved_at | timestamptz |
| paid_at | timestamptz |
| reversed_at | timestamptz |
| metadata | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `earner_member_id -> members(id)`, `source_member_id -> members(id)`, `source_prospect_id -> prospects(id)`, `referral_id -> referrals(id)`, `registration_id -> event_registrations(id)`, `rank_id -> ranks(id)`
Indexes: `(earner_member_id, period_start, period_end)`, `status`, partial `referral_id`

### notifications
Purpose: in-app/email/SMS/push/webhook queue for reminders, cancellations, registrations, scans, rank-ups, commissions, and prospect follow-up tasks.

Columns:
| Column | Type |
| --- | --- |
| id | uuid |
| recipient_profile_id | uuid |
| recipient_member_id | uuid |
| recipient_prospect_id | uuid |
| event_id | uuid |
| notification_type | text |
| channel | notification_channel |
| status | notification_status |
| title | text |
| body | text |
| payload | jsonb |
| scheduled_for | timestamptz |
| sent_at | timestamptz |
| read_at | timestamptz |
| failed_at | timestamptz |
| failure_reason | text |
| created_at | timestamptz |
| updated_at | timestamptz |

Primary key: `id`
Foreign keys: `recipient_profile_id -> profiles(id)`, `recipient_member_id -> members(id)`, `recipient_prospect_id -> prospects(id)`, `event_id -> events(id)`
Indexes: `(recipient_profile_id, status, created_at desc)`, `(recipient_member_id, status, created_at desc)`, `(recipient_prospect_id, status, created_at desc)`, partial queued `scheduled_for`, partial `event_id`

## Complete SQL Schema

The complete executable SQL schema, indexes, seed ranks, and RLS policies live in:

`supabase/schema.sql`

## Row Level Security Strategy

RLS is enabled on every application table.

Access model:
- Public/anonymous users can read published public events and create privacy-consented prospect registrations.
- Authenticated users can read and update their own profile and own member records.
- Members can read sponsored prospects, sponsored registrations, and limited downline genealogy.
- Event creators/hosts can manage their own events, speakers, registrations, and attendance records.
- Admins can manage all tables through the `profiles.is_admin` or `profiles.role = 'admin'` check.
- Commission writes are admin/service-role only; members can read only their own commission ledger.
- Notifications are visible to their recipients; scheduling/sending is admin/service-role work.

Important production note: high-risk writes such as QR scan, attendance confirmation, prospect conversion, genealogy rebuild, commission calculation, and notification fanout should run in server actions or Edge Functions using validated inputs. Do not expose those mutations directly to the browser.

## Supabase Auth Integration Strategy

1. Use Supabase Auth as the identity source. Every authenticated user has `auth.users.id`.
2. Create `profiles.id = auth.users.id` on signup using a database trigger or a server-side onboarding action.
3. A prospect can remain unauthenticated in `prospects`; if they later create an account, attach `prospects.profile_id`.
4. When a prospect converts, create or link a `profiles` row, create `members`, set `prospects.converted_member_id`, and write genealogy closure rows in one transaction.
5. Store app role in `profiles.role`; use `profiles.is_admin` only for global administrative override.
6. Use route-group middleware in Next.js:
   - `(public)` allows anonymous access.
   - `(member)` requires a Supabase session and an active `members` row.
   - `(admin)` requires `profiles.role = 'admin'` or `is_admin = true`.
7. Use service-role credentials only on the server for privileged workflows: commission generation, notification dispatch, admin imports, and genealogy repair.

## Recommended Server Actions

Event actions:
- `createEvent(input)`
- `updateEvent(eventId, input)`
- `publishEvent(eventId)`
- `cancelEvent(eventId, reason)`
- `completeEvent(eventId)`
- `listManageableEvents(filters)`

Registration and QR actions:
- `registerProspectForEvent(eventSlug, input, refCode?)`
- `rsvpMemberToEvent(eventId)`
- `cancelRegistration(registrationId)`
- `getPassByCode(passCode)`
- `scanQrPass(qrPayload, eventId, deviceId?)`
- `manualConfirmAttendance(registrationId)`

Prospect and referral actions:
- `createReferralLink(memberId, eventId?)`
- `resolveReferral(refCode)`
- `claimReferralForProspect(refCode, prospectId)`
- `updateProspectStage(prospectId, stage)`
- `convertProspectToMember(prospectId, profileId, sponsorMemberId)`
- `listSponsoredProspects(filters)`

MLM and commission actions:
- `rebuildGenealogyForMember(memberId)`
- `calculateCommissionsForConversion(memberId, sourceRegistrationId)`
- `approveCommission(commissionId)`
- `markCommissionPaid(commissionId, payoutReference)`
- `reverseCommission(commissionId, reason)`
- `evaluateRankProgress(memberId)`

Notification actions:
- `queueEventReminder(eventId)`
- `queueEventCancellationNotifications(eventId)`
- `queueRegistrationConfirmation(registrationId)`
- `queueAttendanceConfirmation(attendanceRecordId)`
- `markNotificationRead(notificationId)`
- `dispatchQueuedNotifications(batchSize)`

Analytics actions:
- `getMemberDashboardSummary(memberId)`
- `getNoZeroCalendar(memberId, month)`
- `getEventMetrics(eventId)`
- `getAdminOverview(dateRange)`

## Prototype Data Model Weaknesses

- Event registrants are embedded arrays, which prevents scalable querying, uniqueness checks, RLS, and attendance analytics.
- QR pass state is just a string inside registration-like objects; production needs unique pass codes, tamper-resistant payloads, scan timestamps, and scanner identity.
- Member and prospect identity are mixed in UI state. Production needs separate `profiles`, `members`, and `prospects` records with explicit conversion flow.
- Referral attribution is only a URL parameter. Production needs persistent referral records, expiry, claim/convert status, and source event attribution.
- Genealogy is implied but not modeled. Production MLM needs a closure table for fast upline/downline queries at 100,000+ members.
- Commission/pay-in data is represented as counters. Production needs a ledger with source event/registration/member, period, status, approvals, reversals, and payout references.
- Rank and reward logic is hardcoded. Production needs rank definitions and requirements stored in data, with deterministic server-side evaluation.
- Event cancellation only shows a toast. Production needs queued notifications to every registrant and an auditable cancellation timestamp/reason.
- No-Zero streaks are computed from local arrays. Production should derive from attendance records and cache current/best streaks on `members`.
- Data privacy consent is text-only in the prototype. Production needs stored consent flags, timestamps, and source terms version in metadata.
- Admin access is only a view toggle. Production needs Supabase Auth sessions, role checks, RLS, and server-side authorization.
- The prototype is date-fixed and single-tenant. Production should use `timestamptz`, time zones, and eventually add organization/region columns if multiple markets are supported.
