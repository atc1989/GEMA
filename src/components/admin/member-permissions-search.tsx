"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

export function MemberPermissionsSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      const trimmed = value.trim();

      if (trimmed) {
        next.set("q", trimmed);
      } else {
        next.delete("q");
      }
      next.delete("page");

      const url = next.toString() ? `${pathname}?${next.toString()}` : pathname;
      startTransition(() => router.replace(url, { scroll: false }));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, searchParams, value]);

  return (
    <div className="relative max-w-lg">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search members by name or email"
        className="pl-9"
        aria-label="Search members by name or email"
      />
      {pending ? (
        <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-secondary border-t-brand" />
      ) : null}
    </div>
  );
}
