"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { matchesSearch } from "@/components/event/event-filter-bar";

import { updateProspectStage } from "@/lib/actions/prospects";
import type { ProspectStage } from "@/lib/database/types";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PagerControls } from "@/components/ui/pager-controls";
import { DEFAULT_PER_PAGE } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export type MemberProspect = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: ProspectStage;
  source: string | null;
  lastContactedAt: string | null;
  convertedMemberId: string | null;
  createdAt: string;
};

type StageFilter = ProspectStage | "all";

const stageMeta: Record<
  ProspectStage,
  { label: string; shortLabel: string; badgeClass: string; valueClass: string }
> = {
  new: {
    label: "New",
    shortLabel: "New",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    valueClass: "text-slate-700 dark:text-slate-200",
  },
  registered: {
    label: "Registered",
    shortLabel: "Registered",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    valueClass: "text-info",
  },
  attended: {
    label: "Attended",
    shortLabel: "Attended",
    badgeClass: "bg-purple-100 text-purple dark:bg-purple-950 dark:text-purple-200",
    valueClass: "text-purple",
  },
  followup: {
    label: "Follow up",
    shortLabel: "Follow up",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    valueClass: "text-warning",
  },
  converted: {
    label: "Converted",
    shortLabel: "Converted",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    valueClass: "text-success",
  },
  expired: {
    label: "Expired",
    shortLabel: "Expired",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
    valueClass: "text-destructive",
  },
};

const summaryStages: Array<{ key: StageFilter; label: string; icon: LucideIcon }> = [
  { key: "all", label: "Total", icon: Users },
  { key: "registered", label: "Registered", icon: CalendarClock },
  { key: "attended", label: "Attended", icon: CheckCircle2 },
  { key: "followup", label: "Follow up", icon: MessageCircle },
  { key: "converted", label: "Converted", icon: UserRoundCheck },
];

const filterStages: StageFilter[] = [
  "all",
  "new",
  "registered",
  "attended",
  "followup",
  "converted",
  "expired",
];

function formatDate(iso: string | null): string {
  if (!iso) return "Not yet";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "Recently";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function sourceLabel(source: string | null): string {
  if (!source) return "Referral";
  return source
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function MemberProspectsView({
  initialProspects,
  focusId = null,
}: {
  initialProspects: MemberProspect[];
  /** Prospect id to page to, scroll to, and highlight (e.g. from a calendar deep link). */
  focusId?: string | null;
}) {
  const router = useRouter();
  const [prospects, setProspects] = useState(initialProspects);
  const [activeStage, setActiveStage] = useState<StageFilter>("all");
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focusIndex = focusId ? initialProspects.findIndex((p) => p.id === focusId) : -1;
  const [page, setPage] = useState(
    focusIndex >= 0 ? Math.floor(focusIndex / DEFAULT_PER_PAGE) + 1 : 1,
  );
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!focusId) return;
    document
      .getElementById(`prospect-${focusId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId]);

  const counts = useMemo(() => {
    return prospects.reduce(
      (acc, prospect) => {
        acc.all += 1;
        acc[prospect.stage] += 1;
        return acc;
      },
      {
        all: 0,
        new: 0,
        registered: 0,
        attended: 0,
        followup: 0,
        converted: 0,
        expired: 0,
      } satisfies Record<StageFilter, number>,
    );
  }, [prospects]);

  const filteredProspects = useMemo(
    () =>
      prospects.filter(
        (prospect) =>
          (activeStage === "all" || prospect.stage === activeStage) &&
          matchesSearch(q, prospect.fullName, prospect.email, prospect.phone),
      ),
    [activeStage, prospects, q],
  );

  // Paginate after the stage filter so counts stay global; clamp instead of
  // resetting when a filter shrinks the list.
  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visibleProspects = filteredProspects.slice((safePage - 1) * perPage, safePage * perPage);

  const markFollowUp = (prospectId: string) => {
    setError(null);
    setPendingId(prospectId);

    startTransition(async () => {
      const result = await updateProspectStage({ prospectId, stage: "followup" });
      setPendingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setProspects((current) =>
        current.map((prospect) =>
          prospect.id === prospectId
            ? {
                ...prospect,
                stage: result.data.stage,
                lastContactedAt: result.data.lastContactedAt,
              }
            : prospect,
        ),
      );
      router.refresh();
    });
  };

  if (prospects.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-9 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-brand">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold tracking-tight">No prospects yet</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Share a referral link to an event. Everyone who registers through your links appears here,
          ready for follow-up.
        </p>
        <Link
          className={cn(buttonVariants({ variant: "brand" }), "mt-5")}
          href="/member/referrals"
        >
          <Sparkles aria-hidden="true" />
          Get my link
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summaryStages.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveStage(key)}
            className={cn(
              "rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-brand/40 hover:bg-secondary/50",
              activeStage === key && "border-brand/40 bg-secondary text-brand",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
            </div>
            <div
              className={cn(
                "font-heading text-2xl font-extrabold leading-none",
                key !== "all" && stageMeta[key].valueClass,
              )}
            >
              {counts[key]}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prospects"
            aria-label="Search prospects"
            className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-3 text-xs font-bold outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {filterStages.map((stage) => {
            const label = stage === "all" ? "All" : stageMeta[stage].label;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setActiveStage(stage)}
                className={cn(
                  "rounded-full border border-border bg-card px-3 py-2 text-xs font-black text-muted-foreground transition-colors",
                  activeStage === stage && "border-brand bg-brand text-brand-foreground",
                )}
              >
                {label} <span className="font-semibold opacity-80">{counts[stage]}</span>
              </button>
            );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </Card>
      ) : null}

      {filteredProspects.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          No prospects in this stage.
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleProspects.map((prospect) => {
            const meta = stageMeta[prospect.stage];
            const canFollowUp =
              !prospect.convertedMemberId &&
              prospect.stage !== "followup" &&
              prospect.stage !== "converted" &&
              prospect.stage !== "expired";

            return (
              <Card
                key={prospect.id}
                id={`prospect-${prospect.id}`}
                className={cn(
                  "grid gap-3 p-4",
                  prospect.id === focusId && "ring-2 ring-brand",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-info to-brand-dark font-heading text-[13px] font-extrabold text-white">
                    {initials(prospect.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{prospect.fullName}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          {sourceLabel(prospect.source)} - Registered{" "}
                          {formatDate(prospect.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                          meta.badgeClass,
                        )}
                      >
                        {meta.shortLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                  {prospect.email ? (
                    <a
                      className="flex min-w-0 items-center gap-2 hover:text-foreground"
                      href={`mailto:${prospect.email}`}
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{prospect.email}</span>
                    </a>
                  ) : null}
                  {prospect.phone ? (
                    <a
                      className="flex min-w-0 items-center gap-2 hover:text-foreground"
                      href={`tel:${prospect.phone}`}
                    >
                      <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{prospect.phone}</span>
                    </a>
                  ) : null}
                  {!prospect.email && !prospect.phone ? (
                    <span className="text-xs font-semibold text-muted-foreground">
                      No contact details captured.
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    Last follow-up: {formatDate(prospect.lastContactedAt)}
                  </span>
                  {canFollowUp ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      disabled={pendingId === prospect.id}
                      onClick={() => markFollowUp(prospect.id)}
                    >
                      <MessageCircle aria-hidden="true" />
                      {pendingId === prospect.id ? "Saving..." : "Mark follow-up"}
                    </Button>
                  ) : (
                    <span className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-black text-muted-foreground">
                      {prospect.stage === "followup"
                        ? "Ready for next touch"
                        : prospect.stage === "converted"
                          ? "Member converted"
                          : "Closed"}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <PagerControls
        page={safePage}
        count={filteredProspects.length}
        perPage={perPage}
        onPage={setPage}
        onPerPage={setPerPage}
      />
    </div>
  );
}
