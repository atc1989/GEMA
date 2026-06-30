"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult } from "@/lib/actions/types";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EVENT_PERMISSIONS_PATH = "/admin/members/event-permissions";

const updatePublishingPermissionSchema = z.object({
  memberId: z.uuid(),
  canPublishEvents: z.boolean(),
});

type MemberPermissionUpdate = {
  memberId: string;
  canPublishEvents: boolean;
};

type MemberPermissionResult = {
  memberId: string;
  memberName: string;
  canPublishEvents: boolean;
};

export async function updateMemberEventPublishingPermission(
  input: MemberPermissionUpdate,
): Promise<ActionResult<MemberPermissionResult>> {
  await requireAdmin();

  const parsed = updatePublishingPermissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid permission update." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: updateError } = await supabase
    .rpc("update_member_event_publishing_permission", {
      p_member_id: parsed.data.memberId,
      p_can_publish_events: parsed.data.canPublishEvents,
    })
    .single<{
      member_id: string;
      member_name: string | null;
      can_publish_events: boolean;
    }>();

  if (updateError) return { ok: false, error: updateError.message };
  if (!data) return { ok: false, error: "Member permission was not updated." };

  revalidatePath(ADMIN_EVENT_PERMISSIONS_PATH);

  return {
    ok: true,
    data: {
      memberId: data.member_id,
      memberName: data.member_name?.trim() || "Member",
      canPublishEvents: data.can_publish_events,
    },
  };
}
