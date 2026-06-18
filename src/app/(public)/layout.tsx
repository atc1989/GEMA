import { AppShell } from "@/components/shell/app-shell";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      eyebrow="Public Experience"
      role="public"
      subtitle="Invite, registration, rewards, and QR pass surfaces for prospects."
      title="Prospect Invite"
    >
      {children}
    </AppShell>
  );
}
