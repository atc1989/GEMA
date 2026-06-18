import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EventForm } from "@/components/event/event-form";

export default function NewEventPage() {
  return (
    <div className="grid gap-4">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to events
      </Link>
      <div>
        <h2 className="text-lg font-black tracking-tight">Create event</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          New events start as a draft. You can publish once the details are ready.
        </p>
      </div>
      <EventForm mode="create" />
    </div>
  );
}
