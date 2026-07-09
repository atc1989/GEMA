import { AppShell } from "@/components/shell/app-shell";
import { SidebarSignOutButton } from "@/components/shell/sidebar-sign-out-button";
import { requireMember } from "@/lib/auth/require-member";

export default async function GutGuardDailyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await requireMember("/gutguard-daily");

  return (
    <AppShell
      eyebrow="GutGuard Daily"
      role="member"
      subtitle="Daily dose tracking, reminders, journey messages, and support teams connected to your GEMA account."
      title="GutGuard Daily"
      user={{
        name: ctx.profile.fullName ?? ctx.profile.email ?? "Member",
        email: ctx.profile.email ?? "",
        role: "Member",
      }}
      signOutSlot={<SidebarSignOutButton />}
    >
      {children}
    </AppShell>
  );
}
