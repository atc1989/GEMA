import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";
import { buildEventReportRows, toCsv, toPrintHtml, type ReportEvent, type ReportRow } from "@/lib/report";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Bulk report: every event the caller can manage, one file.
 * Admin → all events; member host → their hosted events.
 */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  const profile = await getCurrentProfile();
  if (!profile) return new NextResponse("Not authorized", { status: 401 });

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("events")
    .select("id, title, starts_at, timezone")
    .order("starts_at", { ascending: false })
    .limit(200);

  if (!profile.isAdmin) {
    const ctx = await getCurrentMember();
    if (!ctx) return new NextResponse("Not authorized", { status: 403 });
    query = query.eq("host_member_id", ctx.member.id);
  }

  const { data: events } = await query.returns<ReportEvent[]>();

  const rowsPerEvent = await Promise.all(
    (events ?? []).map((event) => buildEventReportRows(supabase, event)),
  );
  const rows: ReportRow[] = rowsPerEvent.flat();

  if (format === "pdf") {
    return new NextResponse(toPrintHtml("Events report", rows), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="events-report.csv"`,
    },
  });
}
