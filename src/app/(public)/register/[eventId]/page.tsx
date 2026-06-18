import Link from "next/link";
import { ArrowLeft, CalendarX } from "lucide-react";

import { ProspectRegistrationForm } from "@/components/prospect/prospect-registration-form";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils/format";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { eventId } = await params;
  const { ref } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, timezone, status, visibility")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.status !== "published" || event.visibility !== "public") {
    return (
      <EmptyState
        icon={CalendarX}
        title="Registration closed"
        description="This event isn't open for registration, or the link is no longer valid."
      />
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Link
        href={ref ? `/invite/${eventId}?ref=${encodeURIComponent(ref)}` : `/invite/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to event
      </Link>

      <div>
        <h1 className="text-2xl font-black tracking-tight">Reserve your seat</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {event.title} · {formatEventDateTime(event.starts_at, event.timezone)}
        </p>
      </div>

      <ProspectRegistrationForm eventId={eventId} refCode={ref} />
    </div>
  );
}
