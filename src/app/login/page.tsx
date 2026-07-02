import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth/auth-layout";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { getCurrentMember } from "@/lib/auth/require-member";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  const profile = await getCurrentProfile();
  if (profile) {
    // Explicit guard redirect (e.g. ?redirectTo=/admin/events/...) always wins.
    if (redirectTo?.startsWith("/")) redirect(redirectTo);

    // Smart role-based landing.
    if (profile.isAdmin) redirect("/admin");

    const ctx = await getCurrentMember();
    redirect(ctx ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your GEMA email or One Grinders Guild username."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthLayout>
  );
}
