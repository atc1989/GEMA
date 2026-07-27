import { Gift } from "lucide-react";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LeadReferralCard } from "@/components/referral/lead-referral-card";
import { signOutAction } from "@/lib/actions/auth";
import { requireLead } from "@/lib/auth/require-lead";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LeadPage() {
  const ctx = await requireLead();

  const supabase = await createSupabaseServerClient();
  const { data: referral } = await supabase
    .from("referrals")
    .select("ref_code")
    .eq("referrer_prospect_id", ctx.lead.prospectId)
    .limit(1)
    .maybeSingle();

  return (
    <AuthLayout
      title={`Hi ${ctx.lead.fullName.split(" ")[0]}`}
      subtitle="Share your link — anyone who registers through it is credited to your sponsor."
      footer={
        <form action={signOutAction}>
          <button type="submit" className="font-bold text-brand hover:underline">
            Sign out
          </button>
        </form>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
          <Gift className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black">Your referral link</p>
          <p className="text-xs font-semibold text-muted-foreground">
            General link, works for any open event.
          </p>
        </div>
      </div>
      <LeadReferralCard initialRefCode={referral?.ref_code ?? null} />
    </AuthLayout>
  );
}
