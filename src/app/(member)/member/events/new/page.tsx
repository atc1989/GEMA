import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MemberEventForm } from "@/components/event/member-event-form";
import { requireMember } from "@/lib/auth/require-member";

export default async function MemberNewEventPage() {
  const ctx = await requireMember();
  const selfName = ctx.profile.fullName ?? ctx.profile.email ?? undefined;

  return (
    <div className="grid gap-4">
      <Link
        href="/member/events?tab=hosting"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My hosted events
      </Link>
      <div>
        <h2 className="text-lg font-black tracking-tight">Create event</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {ctx.profile.canPublishEvents
            ? "Your event will be published after submission. Fill the details and download your banner to start sharing."
            : "Your event will be submitted for administrator review. Fill the details and download your banner to start sharing."}
        </p>
      </div>
      <MemberEventForm mode="create" selfName={selfName} />
    </div>
  );
}
