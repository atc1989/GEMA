import { Settings } from "lucide-react";

import { ChangePasswordForm } from "@/components/member/change-password-form";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/lib/auth/require-member";

export default async function MemberSettingsPage() {
  const { profile, member } = await requireMember();

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">Settings</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Manage your account information and security.
        </p>
      </div>

      {/* Account info */}
      <section className="grid gap-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
          Account
        </h3>
        <Card className="divide-y divide-border/60 p-0">
          <Row label="Email" value={profile.email ?? "—"} />
          <Row label="Display name" value={profile.fullName || "—"} />
          <Row
            label="Username"
            value={
              <span className="font-mono text-sm font-bold">@{member.username}</span>
            }
          />
          <Row label="Member code" value={<MemberCode code={member.memberCode} />} />
          <Row
            label="Status"
            value={
              <span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand">
                {member.status}
              </span>
            }
          />
        </Card>
      </section>

      {/* Security */}
      <section className="grid gap-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
          Security
        </h3>
        <Card className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-bold">Change password</p>
            </div>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Choose a strong password with at least 8 characters, one uppercase letter, and one
              number.
            </p>
          </div>
          <ChangePasswordForm />
        </Card>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function MemberCode({ code }: { code: string }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold">{code}</span>
  );
}
