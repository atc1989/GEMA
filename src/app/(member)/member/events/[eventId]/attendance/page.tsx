import { redirect } from "next/navigation";

export default async function MemberAttendanceRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/member/events/${eventId}`);
}
