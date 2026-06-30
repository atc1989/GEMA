import Link from "next/link";
import { Search, ShieldCheck, Users } from "lucide-react";

import {
  MemberPublishingPermissionsTable,
  type MemberPublishingPermissionRow,
} from "@/components/admin/member-publishing-permissions-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type MemberRow = {
  id: string;
  username: string | null;
  member_code: string | null;
  status: string;
  profile_id: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_admin: boolean | null;
  can_publish_events: boolean | null;
};

function cleanPage(raw?: string) {
  const page = Number(raw ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function pageHref(page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/members/event-permissions?${suffix}` : "/admin/members/event-permissions";
}

export default async function AdminMemberEventPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: rawPage } = await searchParams;
  const search = (q ?? "").trim();
  const page = cleanPage(rawPage);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = await createSupabaseServerClient();

  let matchingProfileIds: string[] | null = null;
  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    const { data: matchingProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", false)
      .neq("role", "admin")
      .or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
      .limit(200)
      .returns<{ id: string }[]>();
    matchingProfileIds = (matchingProfiles ?? []).map((profile) => profile.id);
  }

  let members: MemberRow[] = [];
  let count = 0;
  let loadError: string | null = null;

  if (matchingProfileIds && matchingProfileIds.length === 0) {
    members = [];
  } else {
    let query = supabase
      .from("members")
      .select("id, username, member_code, status, profile_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (matchingProfileIds) query = query.in("profile_id", matchingProfileIds);

    const { data, error, count: total } = await query.returns<MemberRow[]>();
    members = data ?? [];
    count = total ?? 0;
    loadError = error?.message ?? null;
  }

  const profileIds = members.map((member) => member.profile_id);
  const profileById = new Map<string, ProfileRow>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, is_admin, can_publish_events")
      .in("id", profileIds)
      .returns<ProfileRow[]>();
    if (profileError) loadError = profileError.message;
    for (const profile of profiles ?? []) profileById.set(profile.id, profile);
  }

  const rows: MemberPublishingPermissionRow[] = members
    .map((member) => {
      const profile = profileById.get(member.profile_id);
      if (profile?.is_admin || profile?.role === "admin") return null;
      return {
        id: member.id,
        fullName:
          profile?.full_name?.trim() ||
          profile?.email?.trim() ||
          member.username?.trim() ||
          member.member_code?.trim() ||
          "Member",
        email: profile?.email ?? "No email",
        role: profile?.role ?? member.status,
        hasProfile: Boolean(profile),
        canPublishEvents: profile?.can_publish_events === true,
      };
    })
    .filter((row): row is MemberPublishingPermissionRow => row !== null);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className="text-lg font-black tracking-tight">Event Publishing Permissions</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-muted-foreground">
            Choose which members may publish events without administrator approval.
          </p>
        </div>
        <Card className="flex items-start gap-3 p-3 text-sm font-semibold text-muted-foreground lg:max-w-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>Permission checks run on the server when members create events.</span>
        </Card>
      </div>

      <form action="/admin/members/event-permissions" className="relative max-w-lg">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          name="q"
          defaultValue={search}
          placeholder="Search members by name or email"
          className="pl-9"
        />
      </form>

      {loadError ? (
        <p className="text-sm font-semibold text-destructive">Failed to load members: {loadError}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No members match your search." : "No members found."}
          description={
            search
              ? "Try a different name or email address."
              : "Eligible member accounts will appear here after onboarding."
          }
        />
      ) : (
        <>
          <MemberPublishingPermissionsTable members={rows} />
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Link
                  href={pageHref(Math.max(1, page - 1), search)}
                  aria-disabled={page <= 1}
                  className={cn(
                    "rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted",
                    page <= 1 && "pointer-events-none opacity-50",
                  )}
                >
                  Previous
                </Link>
                <Link
                  href={pageHref(Math.min(totalPages, page + 1), search)}
                  aria-disabled={page >= totalPages}
                  className={cn(
                    "rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted",
                    page >= totalPages && "pointer-events-none opacity-50",
                  )}
                >
                  Next
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
