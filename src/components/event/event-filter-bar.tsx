"use client";

import { Search } from "lucide-react";

import { TYPE_META } from "@/components/event/event-meta";
import type { EventType } from "@/lib/database/types";

/**
 * One-row search + category filter for client-side event lists.
 * Controlled by the parent; filtering is instant — no submit, no reload.
 */

export function matchesSearch(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

export function EventFilterBar({
  q,
  onQ,
  type,
  onType,
  extraOptions,
  placeholder = "Search events or venues",
}: {
  q: string;
  onQ: (v: string) => void;
  type: string;
  onType: (v: string) => void;
  /** Extra category options rendered above the event types (e.g. "Published"). */
  extraOptions?: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
        />
      </div>
      <select
        value={type}
        onChange={(e) => onType(e.target.value)}
        aria-label="Filter by category"
        className="h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none transition-colors focus:border-brand"
      >
        <option value="">All categories</option>
        {(extraOptions ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {(Object.keys(TYPE_META) as EventType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_META[t].label}
          </option>
        ))}
      </select>
    </div>
  );
}
