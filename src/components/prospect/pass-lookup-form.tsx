"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function PassLookupForm({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    router.push(`/passes?email=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <Field
        label="Your email address"
        htmlFor="passEmail"
        hint="Enter the email you used when registering for an event."
      >
        <div className="flex gap-2">
          <Input
            id="passEmail"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="brand" disabled={!email.trim()}>
            <Search aria-hidden="true" />
            Find
          </Button>
        </div>
      </Field>
    </form>
  );
}
