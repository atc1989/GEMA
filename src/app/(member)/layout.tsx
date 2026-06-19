import { AppShell } from "@/components/shell/app-shell";
import { SidebarSignOutButton } from "@/components/shell/sidebar-sign-out-button";
import { requireMember } from "@/lib/auth/require-member";

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await requireMember();

  return (
    <AppShell
      eyebrow="Member Dashboard"
      role="member"
      subtitle="Authenticated member home for events, prospects, passes, and No-Zero progress."
      title="Member Home"
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
