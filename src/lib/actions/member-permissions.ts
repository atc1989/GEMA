"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult } from "@/lib/actions/types";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const supabase = createSupabaseAdminClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, profile_id, username, member_code")
    .eq("id", parsed.data.memberId)
    .maybeSingle<{
      id: string;
      profile_id: string;
      username: string | null;
      member_code: string | null;
    }>();

  if (memberError) return { ok: false, error: memberError.message };
  if (!member) return { ok: false, error: "Member not found." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_admin")
    .eq("id", member.profile_id)
    .maybeSingle<{
      id: string;
      email: string | null;
      full_name: string | null;
      role: string | null;
      is_admin: boolean | null;
    }>();

  if (profileError) return { ok: false, error: profileError.message };
  if (!profile) return { ok: false, error: "Member profile not found." };
  if (profile.is_admin === true || profile.role === "admin") {
    return { ok: false, error: "Administrator accounts are not eligible for member publishing access." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ can_publish_events: parsed.data.canPublishEvents })
    .eq("id", profile.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath(ADMIN_EVENT_PERMISSIONS_PATH);

  return {
    ok: true,
    data: {
      memberId: member.id,
      memberName:
        profile.full_name?.trim() ||
        profile.email?.trim() ||
        member.username?.trim() ||
        member.member_code?.trim() ||
        "Member",
      canPublishEvents: parsed.data.canPublishEvents,
    },
  };
}
