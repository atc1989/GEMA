import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDashed, ScanLine, UserCheck } from "lucide-react";

import { AttendanceStats } from "@/components/attendance/attendance-stats";
import {
  AttendanceTable,
  type AttendanceRow,
} from "@/components/attendance/attendance-table";
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
        <Link
          href={`/admin/events/${id}/scan`}
          className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
        >
          <ScanLine aria-hidden="true" />
          Open scanner
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-black tracking-tight">{event.title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Attendance overview
        </p>
      </div>

      <AttendanceStats
        totalRegistrations={registrations.length}
        totalAttendees={checkedRows.length}
      />

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
