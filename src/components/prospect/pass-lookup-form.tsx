"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PassLookupForm({ defaultQuery }: { defaultQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/passes?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <Field
        label="Email or mobile number"
        htmlFor="passQuery"
        hint="Enter the email address or mobile number you used when registering."
      >
        <div className="flex gap-2">
          <Input
            id="passQuery"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com or 09XX XXX XXXX"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
          <Button type="submit" variant="brand" disabled={!query.trim()}>
            <Search aria-hidden="true" />
            Find
          </Button>
        </div>
      </Field>
    </form>
  );
}
