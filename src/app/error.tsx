"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * App-wide error boundary.
 *
 * It exists because the auth guards now throw on a failed check instead of
 * redirecting to /login — that redirect is what signed people out. Next strips
 * the message before it reaches the client, so this cannot say which error it
 * is; what matters is that the session survives and Try again is one click
 * away. The digest lines this page up with the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center p-6">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          You are still signed in. This was a problem on our side — try again.
        </p>
        <Button className="mt-2" onClick={reset}>
          Try again
        </Button>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
