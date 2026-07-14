import { MemberImportForm } from "@/components/admin/member-import-form";

export const metadata = { title: "Import members" };

export default function AdminMemberImportPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-black tracking-tight">Import member credentials</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Upload backup usernames, emails, and passwords so members can still sign in to GEMA
          when the OneGrinders login service is down. Existing members are updated; new
          usernames get a local account right away.
        </p>
      </div>

      <MemberImportForm />
    </div>
  );
}
