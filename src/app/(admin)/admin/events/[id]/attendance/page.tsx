import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDashed, ScanLine, UserCheck } from "lucide-react";

import { AttendanceStats } from "@/components/attendance/attendance-stats";
import {
  AttendanceTable,
  type AttendanceRow,
} from "@/components/attendance/attendance-table";
import {
  InviterLeaderboard,
  type InviterRow,
} from "@/components/attendance/inviter-leaderboard";
import { ExportReportMenu } from "@/components/event/export-report-menu";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { RegistrationKind } from "@/lib/database/types";

type RegRow = {
  id: string;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  registered_at: string;
  registration_kind: RegistrationKind;
};

type SponsorRow = {
  registration_id: string;
  ref_code: string | null;
  sponsor_name: string | null;
};

export default async function EventAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, status")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: regs }, { data: atts }, { data: sponsors }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("id, attendee_name, attendee_email, attendee_phone, registered_at, registration_kind")
      .eq("event_id", id)
      .neq("status", "cancelled")
      .order("registered_at", { ascending: true })
      .returns<RegRow[]>(),
    supabase
      .from("attendance_records")
      .select("registration_id, checked_in_at")
      .eq("event_id", id)
      .returns<{ registration_id: string; checked_in_at: string }[]>(),
    supabase.rpc("get_event_attendee_sponsors", { p_event_id: id }),
  ]);

  const registrations = regs ?? [];
  const checkedInAtById = new Map(
    (atts ?? []).map((a) => [a.registration_id, a.checked_in_at]),
  );
  const sponsorById = new Map(
    ((sponsors ?? []) as SponsorRow[]).map((s) => [s.registration_id, s]),
  );

  const toRow = (r: RegRow): AttendanceRow => ({
    id: r.id,
    name: r.attendee_name,
    kind: r.registration_kind,
    email: r.attendee_email,
    phone: r.attendee_phone,
    invitedBy: sponsorById.get(r.id)?.sponsor_name ?? null,
    refCode: sponsorById.get(r.id)?.ref_code ?? null,
    registeredAt: r.registered_at,
    checkedInAt: checkedInAtById.get(r.id) ?? null,
  });

  const checkedRows = registrations
    .filter((r) => checkedInAtById.has(r.id))
    .map(toRow);
  const pendingRows = registrations
    .filter((r) => !checkedInAtById.has(r.id))
    .map(toRow);

  const membersCheckedIn = checkedRows.filter((r) => r.kind === "member").length;
  const prospectsCheckedIn = checkedRows.length - membersCheckedIn;

  // Recruiting leaderboard: invited counts per sponsor, ranked by total.
  const inviterAgg = new Map<string, InviterRow>();
  for (const r of registrations) {
    const sponsorInfo = sponsorById.get(r.id);
    const sponsor = sponsorInfo?.sponsor_name;
    if (!sponsor) continue;
    const agg = inviterAgg.get(sponsor) ?? {
      name: sponsor,
      membersInvited: 0,
      prospectsInvited: 0,
      checkedIn: 0,
      refCodes: [],
    };
    if (r.registration_kind === "member") agg.membersInvited++;
    else agg.prospectsInvited++;
    if (checkedInAtById.has(r.id)) agg.checkedIn++;
    if (sponsorInfo.ref_code && !agg.refCodes.includes(sponsorInfo.ref_code)) {
      agg.refCodes.push(sponsorInfo.ref_code);
    }
    inviterAgg.set(sponsor, agg);
  }
  const inviters = [...inviterAgg.values()].sort(
    (a, b) =>
      b.membersInvited + b.prospectsInvited - (a.membersInvited + a.prospectsInvited),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to event
        </Link>
        <div className="flex items-center gap-2">
          <ExportReportMenu href={`/api/events/${id}/report`} />
          <Link
            href={`/admin/events/${id}/scan`}
            className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
          >
            <ScanLine aria-hidden="true" />
            Open scanner
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-black tracking-tight">{event.title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Attendance overview
        </p>
      </div>

      <AttendanceStats
        totalRegistrations={registrations.length}
        membersCheckedIn={membersCheckedIn}
        prospectsCheckedIn={prospectsCheckedIn}
      />

      <InviterLeaderboard rows={inviters} />

      <AttendanceTable
        title="Checked in"
        icon={UserCheck}
        rows={checkedRows}
        emptyLabel="No check-ins yet."
        variant="checked"
      />

      <AttendanceTable
        title="Not yet checked in"
        icon={CircleDashed}
        rows={pendingRows}
        emptyLabel="Everyone registered has checked in."
        variant="pending"
      />
    </div>
  );
}
