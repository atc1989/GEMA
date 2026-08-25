import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { GinhawaLandingForm } from "@/components/ginhawa/ginhawa-landing-form";
import { loadGinhawaLandingForm } from "@/lib/ginhawa/load";

export default async function AdminGinhawaEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const loaded = await loadGinhawaLandingForm(eventId);
  if (!loaded) notFound();

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
        <h2 className="text-lg font-black tracking-tight">Edit Ginhawa copy</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Prefill from {loaded.eventTitle}. Edits stay on Ginhawa and do not change the event.
        </p>
      </div>
      <GinhawaLandingForm defaultValues={loaded.values} eventTitle={loaded.eventTitle} />
    </div>
  );
}
