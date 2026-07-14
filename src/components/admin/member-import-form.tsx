"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Upload } from "lucide-react";

import {
  importMemberCredentials,
  type ImportRow,
  type ImportRowResult,
} from "@/lib/actions/member-import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ParsedRow = ImportRow & { line: number; issue: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits on the first two commas only, so passwords containing commas survive. */
function parseLine(line: string): { username: string; email: string; password: string } | null {
  const first = line.indexOf(",");
  if (first === -1) return null;
  const second = line.indexOf(",", first + 1);
  if (second === -1) return null;
  return {
    username: line.slice(0, first).trim(),
    email: line.slice(first + 1, second).trim(),
    password: line.slice(second + 1),
  };
}

function parseCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    // Skip a header row.
    if (index === 0 && line.toLowerCase().replace(/\s/g, "").startsWith("username,")) return;

    const parts = parseLine(line);
    if (!parts) {
      rows.push({
        line: index + 1,
        username: line.slice(0, 30),
        email: null,
        password: "",
        issue: "Expected: username,email,password (leave email blank as username,,password).",
      });
      return;
    }

    const username = parts.username.toLowerCase();
    const email = parts.email ? parts.email.toLowerCase() : null;
    let issue: string | null = null;

    if (!username) issue = "Username is missing.";
    else if (!parts.password) issue = "Password is missing.";
    else if (parts.password.length < 6) issue = "Password must be at least 6 characters.";
    else if (email && !EMAIL_RE.test(email)) issue = "Email looks invalid.";
    else if (seenUsernames.has(username)) issue = "Duplicate username in this file.";
    else if (email && seenEmails.has(email)) issue = "Duplicate email in this file.";

    seenUsernames.add(username);
    if (email) seenEmails.add(email);
    rows.push({ line: index + 1, username, email, password: parts.password, issue });
  });

  return rows;
}

export function MemberImportForm() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => parseCsv(text), [text]);
  const invalid = rows.filter((r) => r.issue);
  const canImport = rows.length > 0 && invalid.length === 0 && !pending;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void file.text().then((content) => {
      setText(content);
      setResults(null);
    });
  };

  const onImport = () => {
    setError(null);
    setResults(null);
    startTransition(async () => {
      const result = await importMemberCredentials(
        rows.map(({ username, email, password }) => ({ username, email, password })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults(result.data);
    });
  };

  return (
    <div className="grid gap-4">
      <Card className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">
            Paste rows as <code className="rounded bg-muted px-1">username,email,password</code>
            <span className="text-muted-foreground"> — leave email blank: </span>
            <code className="rounded bg-muted px-1">username,,password</code>
          </p>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary">
              <Upload className="size-3.5" aria-hidden="true" /> Load CSV file
            </span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResults(null);
          }}
          rows={10}
          placeholder={"juandelacruz,juan@gmail.com,secret123\nmariasantos,,anotherpass"}
          className="font-mono text-xs"
        />

        {rows.length > 0 ? (
          <p className="text-xs font-semibold text-muted-foreground">
            {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
            {invalid.length === 0 ? (
              <span className="text-brand">all valid</span>
            ) : (
              <span className="text-destructive">{invalid.length} with problems</span>
            )}
          </p>
        ) : null}

        {invalid.length > 0 ? (
          <ul className="grid gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            {invalid.slice(0, 10).map((r) => (
              <li key={r.line}>
                Line {r.line} ({r.username || "?"}): {r.issue}
              </li>
            ))}
            {invalid.length > 10 ? <li>…and {invalid.length - 10} more.</li> : null}
          </ul>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}

        <Button onClick={onImport} disabled={!canImport} variant="brand" className="justify-self-start">
          {pending ? "Importing…" : `Import ${rows.length || ""} member${rows.length === 1 ? "" : "s"}`}
        </Button>
      </Card>

      {results ? (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {results.map((r) => (
              <li key={r.username} className="flex items-center gap-2 px-4 py-2 text-sm">
                {r.outcome === "failed" ? (
                  <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
                )}
                <span className="font-bold">@{r.username}</span>
                <span
                  className={
                    r.outcome === "failed"
                      ? "font-semibold text-destructive"
                      : "font-semibold text-muted-foreground"
                  }
                >
                  {r.outcome}
                  {r.reason ? ` — ${r.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
