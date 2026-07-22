"use client";

import { useState, useTransition } from "react";
import { StickyNote } from "lucide-react";

import { updateRegistrationNote } from "@/lib/actions/attendance";

/** Inline-editable admin note on an attendance row. Saves on blur; not shown to the attendee. */
export function RegistrationNoteField({
  eventId,
  registrationId,
  initialNote,
}: {
  eventId: string;
  registrationId: string;
  initialNote: string | null;
}) {
  const [value, setValue] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(initialNote ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (value === saved) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRegistrationNote({ eventId, registrationId, note: value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.data.note ?? "");
      setValue(result.data.note ?? "");
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <StickyNote className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="Add note…"
        disabled={pending}
        maxLength={500}
        aria-label="Admin note"
        className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:border-border focus:border-ring focus:bg-background focus:text-foreground disabled:opacity-50"
      />
      {error ? <span className="shrink-0 text-[10px] font-semibold text-destructive">{error}</span> : null}
    </div>
  );
}
