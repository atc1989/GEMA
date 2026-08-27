import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { GinhawaLandingForm } from "@/components/ginhawa/ginhawa-landing-form";
import { loadGinhawaLandingForm } from "@/lib/ginhawa/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminGinhawaEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const loaded = await loadGinhawaLandingForm(eventId);
  if (!loaded) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("slug")
    .eq("id", eventId)
    .maybeSingle<{ slug: string }>();

  return (
    <div className="grid gap-4">
      <Link
        href="/admin/ginhawa"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to events
      </Link>
      <div>
        <h2 className="text-lg font-black tracking-tight">Edit landing copy</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Prefill from {loaded.eventTitle}. Medical template. Edits do not change the event record
          itself.
          {loaded.published && event?.slug ? (
            <>
              {" "}
              <Link
                href={`/e/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand"
              >
                View live page
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <GinhawaLandingForm defaultValues={loaded.values} eventTitle={loaded.eventTitle} />
    </div>
  );
}
