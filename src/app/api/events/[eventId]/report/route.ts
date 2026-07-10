import { NextResponse } from "next/server";

import { buildEventReportRows, toCsv, toPrintHtml, type ReportEvent } from "@/lib/report";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Per-event attendance/referral report. Admin or event host (can_manage_event). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  const supabase = await createSupabaseServerClient();
  const { data: canManage } = await supabase.rpc("can_manage_event", {
    target_event_id: eventId,
  });
  if (canManage !== true) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, timezone")
    .eq("id", eventId)
    .maybeSingle<ReportEvent>();
  if (!event) return new NextResponse("Event not found", { status: 404 });

  const rows = await buildEventReportRows(supabase, event);

  if (format === "pdf") {
    return new NextResponse(toPrintHtml(`Event report — ${event.title}`, rows), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-report-${eventId.slice(0, 8)}.csv"`,
    },
  });
}
