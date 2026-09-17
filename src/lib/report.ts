import type { GemaClient } from "@/lib/supabase/types";

/**
 * Event attendance/referral report shared by the per-event and bulk export
 * routes. One flat table: a summary row per event, one row per referral link
 * used, then one row per attendee (name/email/number/check-in time). Inviter
 * names come from the get_event_attendee_sponsors RPC so member hosts get
 * complete data under RLS.
 */

/** Base columns. The admin-only Notes column is appended by `reportHeaders`. */
export const REPORT_HEADERS = [
  "Event",
  "Event date",
  "Row",
  "Referral links used",
  "Members checked in",
  "Prospects checked in",
  "Link code",
  "Link owner",
  "Prospects via link",
  "Checked in via link",
  "Name",
  "Email",
  "Number",
  "Type",
  "Checked in at",
] as const;

export type ReportRow = (string | number)[];

/**
 * `notes`: include the admin-only note each registration carries.
 *
 * Off by default, and the routes only turn it on for admins. RLS lets any
 * event manager read `admin_note`, but the attendance screen shows the field
 * on the admin view alone (`AttendanceTable showNotes`) — an export that
 * handed it to member hosts would quietly undo that.
 */
export type ReportOptions = { notes?: boolean };

/** Column headings for a report built with the same options. */
export function reportHeaders({ notes = false }: ReportOptions = {}): readonly string[] {
  return notes ? [...REPORT_HEADERS, "Notes"] : REPORT_HEADERS;
}

export type ReportEvent = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
};

type RegRow = {
  id: string;
  registration_kind: "member" | "prospect";
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  admin_note: string | null;
};
type SponsorRow = { registration_id: string; ref_code: string | null; sponsor_name: string | null };

export async function buildEventReportRows(
  supabase: GemaClient,
  event: ReportEvent,
  { notes = false }: ReportOptions = {},
): Promise<ReportRow[]> {
  const [regsRes, attsRes, sponsorsRes] = await Promise.all([
    supabase
      .from("event_registrations")
      .select(
        "id, registration_kind, attendee_name, attendee_email, attendee_phone, admin_note",
      )
      .eq("event_id", event.id)
      .neq("status", "cancelled")
      .order("registered_at", { ascending: true })
      .returns<RegRow[]>(),
    supabase
      .from("attendance_records")
      .select("registration_id, checked_in_at")
      .eq("event_id", event.id)
      .returns<{ registration_id: string; checked_in_at: string }[]>(),
    supabase.rpc("get_event_attendee_sponsors", { p_event_id: event.id }),
  ]);

  const regs = regsRes.data ?? [];
  const checkedInAt = new Map(
    (attsRes.data ?? []).map((a) => [a.registration_id, a.checked_in_at]),
  );
  const checkedIn = new Set(checkedInAt.keys());
  const allSponsors = (sponsorsRes.data ?? []) as SponsorRow[];
  const sponsors = allSponsors.filter((s) => s.ref_code);
  const sponsorById = new Map(allSponsors.map((s) => [s.registration_id, s]));

  const kindById = new Map(regs.map((r) => [r.id, r.registration_kind]));
  const membersCheckedIn = regs.filter(
    (r) => r.registration_kind === "member" && checkedIn.has(r.id),
  ).length;
  const prospectsCheckedIn = regs.filter(
    (r) => r.registration_kind === "prospect" && checkedIn.has(r.id),
  ).length;

  // Per referral link: who owns it, how many prospects it brought, how many arrived.
  const byLink = new Map<string, { owner: string; prospects: number; checked: number }>();
  for (const s of sponsors) {
    if (!kindById.has(s.registration_id)) continue;
    const link = byLink.get(s.ref_code!) ?? {
      owner: s.sponsor_name ?? "—",
      prospects: 0,
      checked: 0,
    };
    link.prospects++;
    if (checkedIn.has(s.registration_id)) link.checked++;
    byLink.set(s.ref_code!, link);
  }

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: event.timezone || "UTC",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone || "UTC",
  });
  const date = dateFmt.format(new Date(event.starts_at));

  const width = reportHeaders({ notes }).length;
  const pad = (row: ReportRow) => row.concat(Array(width - row.length).fill(""));

  const rows: ReportRow[] = [
    pad([event.title, date, "Summary", byLink.size, membersCheckedIn, prospectsCheckedIn]),
  ];
  const links = [...byLink.entries()].sort((a, b) => b[1].prospects - a[1].prospects);
  for (const [code, link] of links) {
    rows.push(pad([event.title, date, "Link", "", "", "", code, link.owner, link.prospects, link.checked]));
  }
  // One row per registrant: name/email/number split out, check-in timestamp if
  // attended, and the admin note last when this report carries notes.
  for (const r of regs) {
    const checked = checkedInAt.get(r.id);
    const sponsor = sponsorById.get(r.id);
    const row: ReportRow = [
      event.title,
      date,
      "Attendee",
      "", "", "",
      sponsor?.ref_code ?? "",
      sponsor?.sponsor_name ?? "",
      "", "",
      r.attendee_name,
      r.attendee_email ?? "",
      r.attendee_phone ?? "",
      r.registration_kind,
      checked ? dateTimeFmt.format(new Date(checked)) : "",
    ];
    // Newlines survive: csvCell quotes them, and the print view keeps them with
    // white-space: pre-line.
    if (notes) row.push(r.admin_note ?? "");
    rows.push(row);
  }
  return rows;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ReportRow[], options: ReportOptions = {}): string {
  return [reportHeaders(options), ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function esc(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Self-contained print view; the browser's print dialog produces the PDF. */
export function toPrintHtml(
  title: string,
  rows: ReportRow[],
  options: ReportOptions = {},
): string {
  const headers = reportHeaders(options);
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  // A note is free text and can hold line breaks; the column index moves with
  // the options, so mark the cell rather than styling by position.
  const noteAt = options.notes ? headers.length - 1 : -1;
  const body = rows
    .map(
      (row) =>
        `<tr${row[2] === "Summary" ? ' class="summary"' : ""}>${row
          .map((c, i) => `<td${i === noteAt ? ' class="note"' : ""}>${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#1a2b45}
h1{font-size:18px;margin:0 0 4px}
p{font-size:12px;color:#64748b;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left}
th{background:#eef2f7;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
tr.summary td{background:#f8fafc;font-weight:700}
td.note{white-space:pre-line;min-width:140px}
@media print{body{margin:0}}
</style></head>
<body>
<h1>${esc(title)}</h1>
<p>Generated ${new Date().toISOString().slice(0, 10)} · use your browser's print dialog to save as PDF</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.print()</script>
</body></html>`;
}
