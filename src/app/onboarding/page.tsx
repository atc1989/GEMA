import { redirect } from "next/navigation";

import { MemberOnboardingForm } from "@/components/member/member-onboarding-form";
import { Card } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/require-member";
import { getCurrentProfile } from "@/lib/auth/require-admin";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const member = await getCurrentMember();
  if (member) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight">Activate your membership</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Pick a username to start sharing events and earning referrals.
          </p>
        </div>
        <Card className="p-6">
          <MemberOnboardingForm defaultSponsorRef={ref} />
        </Card>
      </div>
    </div>
  );
}
