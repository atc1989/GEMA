import { AppShell } from "@/components/shell/app-shell";
import { SidebarSignOutButton } from "@/components/shell/sidebar-sign-out-button";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requireAdmin();

  return (
    <AppShell
      eyebrow="Admin Workspace"
      role="admin"
      subtitle="Event management, registrant review, attendance scanning, and reporting."
      title="Admin Events"
      user={{
        name: profile.fullName,
        email: profile.email ?? "",
        role: "Admin",
      }}
      signOutSlot={<SidebarSignOutButton />}
    >
      {children}
    </AppShell>
  );
}
