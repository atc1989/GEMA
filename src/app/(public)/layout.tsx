import { AppShell } from "@/components/shell/app-shell";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      eyebrow="Gutguard"
      role="public"
      subtitle="Events, rewards, and your pass."
      title="Gutguard Events"
    >
      {children}
    </AppShell>
  );
}
