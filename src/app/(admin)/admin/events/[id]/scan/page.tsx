import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { AttendanceScanner } from "@/components/attendance/attendance-scanner";
import { buttonVariants } from "@/components/ui/button";
import { requireEventManager } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AttendanceScannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireEventManager(id);

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, status")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Link
        href={`/admin/events/${id}/attendance`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Attendance dashboard
      </Link>

      <div>
        <h2 className="text-lg font-black tracking-tight">Check-in scanner</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{event.title}</p>
      </div>

      <AttendanceScanner eventId={id} />

      <Link
        href={`/admin/events/${id}/attendance`}
        className={cn(buttonVariants({ variant: "outline" }), "w-full")}
      >
        <BarChart3 aria-hidden="true" />
        View attendance stats
      </Link>
    </div>
  );
}
